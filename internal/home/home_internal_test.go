package home

import (
	"cmp"
	"context"
	"net/http"
	"net/netip"
	"testing"
	"time"

	"github.com/AdguardTeam/AdGuardHome/internal/agh"
	"github.com/AdguardTeam/AdGuardHome/internal/aghhttp"
	"github.com/AdguardTeam/golibs/logutil/slogutil"
	"github.com/AdguardTeam/golibs/netutil"
	"github.com/AdguardTeam/golibs/testutil"
	"github.com/AdguardTeam/golibs/timeutil"
	"github.com/stretchr/testify/require"
)

// testTimeout is the common timeout for tests and contexts.
const testTimeout = 1 * time.Second

// testLogger is a common logger for tests.
var testLogger = slogutil.NewDiscardLogger()

// testTrustedProxies is a common trusted proxies set for tests.
var testTrustedProxies = netutil.SliceSubnetSet([]netip.Prefix{})

// newTestWeb is a helper that creates new webAPI and fills it's config with
// given values.  If conf is nil, the default configuration will be used.
func newTestWeb(
	tb testing.TB,
	conf *webConfig,
) (web *webAPI) {
	tb.Helper()

	ctx := testutil.ContextWithTimeout(tb, testTimeout)
	conf = cmp.Or(conf, &webConfig{})

	web, err := newWeb(ctx, &webConfig{
		clientBuildFS:  conf.clientBuildFS,
		updater:        conf.updater,
		opts:           conf.opts,
		baseLogger:     testLogger,
		tlsManager:     conf.tlsManager,
		auth:           conf.auth,
		mux:            cmp.Or(conf.mux, http.NewServeMux()),
		configModifier: cmp.Or[agh.ConfigModifier](conf.configModifier, &agh.EmptyConfigModifier{}),
		httpReg:        cmp.Or[aghhttp.Registrar](conf.httpReg, &aghhttp.EmptyRegistrar{}),
		workDir:        conf.workDir,
		confPath:       conf.confPath,
		isCustomUpdURL: conf.isCustomUpdURL,
		isFirstRun:     conf.isFirstRun,
	})

	require.NoError(tb, err)

	return web
}

// storeGlobals is a test helper function that saves global variables and
// restores them once the test is complete.
//
// The global variables are:
//   - [config]
//   - [globalContext.clients.storage]
//   - [globalContext.dnsServer]
//
// TODO(s.chzhen):  Remove this once the TLS manager no longer accesses global
// variables.  Make tests that use this helper concurrent.
func storeGlobals(tb testing.TB) {
	tb.Helper()

	prevConfig := config
	storage := globalContext.clients.storage
	dnsServer := globalContext.dnsServer

	tb.Cleanup(func() {
		config = prevConfig
		globalContext.clients.storage = storage
		globalContext.dnsServer = dnsServer
	})
}

func TestMain(m *testing.M) {
	initCmdLineOpts()

	testutil.DiscardLogOutput(m)
}

func TestOrDefault(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		value  string
		def    string
		expect string
	}{
		{name: "empty value", value: "", def: "default", expect: "default"},
		{name: "non-empty value", value: "custom", def: "default", expect: "custom"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			require.Equal(t, test.expect, orDefault(test.value, test.def))
		})
	}
}

func TestTrailingDot(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		value  string
		def    string
		expect string
	}{
		{name: "empty value", value: "", def: "sb.dns.adguard.com.", expect: "sb.dns.adguard.com."},
		{name: "value without dot", value: "example.com", def: "default.", expect: "example.com."},
		{name: "value with dot", value: "example.com.", def: "default.", expect: "example.com."},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			require.Equal(t, test.expect, trailingDot(test.value, test.def))
		})
	}
}

func TestOrDefaultDuration(t *testing.T) {
	t.Parallel()

	def := timeutil.Duration(3 * time.Second)

	tests := []struct {
		name   string
		value  timeutil.Duration
		expect timeutil.Duration
	}{
		{name: "zero value", value: 0, expect: def},
		{name: "negative value", value: timeutil.Duration(-time.Second), expect: def},
		{name: "positive value", value: timeutil.Duration(10 * time.Second), expect: timeutil.Duration(10 * time.Second)},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			require.Equal(t, test.expect, orDefaultDuration(test.value, def))
		})
	}
}

func TestNewServiceBootstrapResolver(t *testing.T) {
	t.Parallel()

	t.Run("default resolver is returned for empty addresses", func(t *testing.T) {
		t.Parallel()

		r, resolvers, err := newServiceBootstrapResolver(
			context.Background(),
			testLogger,
			[]string{"", "# comment"},
			timeutil.Duration(3*time.Second),
		)

		require.NoError(t, err)
		require.Nil(t, resolvers)
		require.Equal(t, safeBrowsingResolvers, r)
	})

	t.Run("custom resolvers are parsed and wrapped", func(t *testing.T) {
		t.Parallel()

		r, resolvers, err := newServiceBootstrapResolver(
			context.Background(),
			testLogger,
			[]string{"192.0.2.1", "192.0.2.2"},
			timeutil.Duration(3*time.Second),
		)

		require.NoError(t, err)
		require.Len(t, resolvers, 2)
		require.NotNil(t, r)

		for _, resolver := range resolvers {
			require.NoError(t, resolver.Close())
		}
	})

	t.Run("invalid address is rejected", func(t *testing.T) {
		t.Parallel()

		_, resolvers, err := newServiceBootstrapResolver(
			context.Background(),
			testLogger,
			[]string{"https://example.com/not-a-dns-path"},
			timeutil.Duration(3*time.Second),
		)

		require.Error(t, err)
		require.Nil(t, resolvers)
	})

	t.Run("domain-name bootstrap is rejected with a hint", func(t *testing.T) {
		t.Parallel()

		_, resolvers, err := newServiceBootstrapResolver(
			context.Background(),
			testLogger,
			[]string{"1.1.1.1", "https://dns10.quad9.net/dns-query"},
			timeutil.Duration(3*time.Second),
		)

		require.Error(t, err)
		require.Nil(t, resolvers)
		require.Contains(t, err.Error(), "IP-literal")
	})
}
