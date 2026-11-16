import { createMemo, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import cn from 'clsx';
import intl from 'panel/common/intl';
import { Checkbox } from 'panel/common/controls/Checkbox';
import { SwitchGroup } from 'panel/common/ui/SettingsGroup';
import { Button } from 'panel/common/ui/Button';
import { PageLoader } from 'panel/common/ui/Loader';
import {
    clientFormState,
    updateClientFormField,
    saveClient,
    clearClientForm,
} from 'panel/stores/clientForm';
import { useInitClientFormFromRoute } from 'panel/hooks/useInitClientFormFromRoute';
import {
    SAFE_SEARCH_PROVIDERS,
    SAFE_SEARCH_PROVIDER_KEYS,
    type SafeSearchProviderKey,
} from 'panel/helpers/constants';
import { Paths, RoutePath, linkPathBuilder } from 'panel/components/Routes/Paths';
import theme from 'panel/lib/theme';

import { ClientsHeader } from '../ClientsHeader';

import s from './Protection.module.pcss';

export const Protection = () => {
    const navigate = useNavigate();

    useInitClientFormFromRoute();

    const disabled = createMemo(() => clientFormState.use_global_settings);
    const isEdit = createMemo(() => clientFormState.mode === 'edit');

    const handleSave = async () => {
        const result = await saveClient();
        if (result) {
            navigate(Paths.Clients);
        }
    };

    const handleCancel = () => {
        clearClientForm();
        navigate(
            isEdit()
                ? linkPathBuilder(RoutePath.ClientsEdit, {
                      clientName: encodeURIComponent(clientFormState.originalName),
                  })
                : Paths.ClientsAdd,
        );
    };

    const handleToggle = (field: keyof typeof clientFormState) => (e: Event) => {
        updateClientFormField(field, (e.target as HTMLInputElement).checked);
    };

    const handleSafeSearchEnabled = (e: Event) => {
        const enabled = (e.target as HTMLInputElement).checked;
        const providersUpdate: Record<string, boolean> = {};
        if (enabled) {
            // Preserve the user's provider selection when re-enabling; only
            // default all providers to on when none has been selected yet.
            const hasAnyProvider = SAFE_SEARCH_PROVIDER_KEYS.some(
                (key) => clientFormState.safe_search[key],
            );
            if (!hasAnyProvider) {
                SAFE_SEARCH_PROVIDER_KEYS.forEach((key) => {
                    providersUpdate[key] = true;
                });
            }
        }
        updateClientFormField('safe_search', {
            ...clientFormState.safe_search,
            enabled,
            ...providersUpdate,
        });
    };

    const handleSafeSearchProvider = (provider: SafeSearchProviderKey) => (e: Event) => {
        updateClientFormField('safe_search', {
            ...clientFormState.safe_search,
            [provider]: (e.target as HTMLInputElement).checked,
        });
    };

    return (
        <div class={cn(theme.layout.container, s.containerOverride)}>
            <ClientsHeader currentTitle={intl.getMessage('clients_protection')} />

            <div class={cn(theme.layout.containerIn, theme.layout.containerIn_one_col)}>
                <Show when={clientFormState.processingSave}>
                    <PageLoader />
                </Show>

                <Show when={!clientFormState.processingSave}>
                    <SwitchGroup
                        id="filtering-enabled"
                        title={intl.getMessage('settings_filter_requests')}
                        checked={clientFormState.filtering_enabled}
                        onChange={handleToggle('filtering_enabled')}
                        disabled={disabled()}
                    />

                    <SwitchGroup
                        id="safebrowsing-enabled"
                        title={intl.getMessage('settings_browsing_security')}
                        checked={clientFormState.safebrowsing_enabled}
                        onChange={handleToggle('safebrowsing_enabled')}
                        disabled={disabled()}
                    />

                    <SwitchGroup
                        id="parental-enabled"
                        title={intl.getMessage('settings_parental_control')}
                        checked={clientFormState.parental_enabled}
                        onChange={handleToggle('parental_enabled')}
                        disabled={disabled()}
                    />

                    <SwitchGroup
                        id="safe-search"
                        title={intl.getMessage('settings_safe_search')}
                        checked={clientFormState.safe_search.enabled}
                        onChange={handleSafeSearchEnabled}
                        disabled={disabled()}
                    >
                        <For each={SAFE_SEARCH_PROVIDER_KEYS}>
                            {(key) => (
                                <div
                                    class={cn(s.checkboxRow, {
                                        [s.checkboxRowDisabled]:
                                            disabled() || !clientFormState.safe_search.enabled,
                                    })}
                                >
                                    <Checkbox
                                        id={`safe-search-${key}`}
                                        class={s.checkboxFull}
                                        checked={clientFormState.safe_search[key]}
                                        onChange={handleSafeSearchProvider(key)}
                                        disabled={disabled() || !clientFormState.safe_search.enabled}
                                    >
                                        {SAFE_SEARCH_PROVIDERS[key]}
                                    </Checkbox>
                                </div>
                            )}
                        </For>
                    </SwitchGroup>

                    <h2 class={cn(theme.layout.subtitle, theme.title.h5, theme.title.h4_tablet)}>
                        {intl.getMessage('clients_logs_and_statistics')}
                    </h2>

                    <SwitchGroup
                        id="ignore-querylog"
                        title={intl.getMessage('clients_dont_log')}
                        checked={clientFormState.ignore_querylog}
                        onChange={handleToggle('ignore_querylog')}
                    />

                    <SwitchGroup
                        id="ignore-statistics"
                        title={intl.getMessage('clients_dont_collect_stats')}
                        checked={clientFormState.ignore_statistics}
                        onChange={handleToggle('ignore_statistics')}
                    />

                    <div class={s.actions}>
                        <Button
                            variant="primary"
                            size="small"
                            onClick={handleSave}
                            disabled={clientFormState.processingSave}
                            data-testid="protection-save"
                            class={s.actionButton}
                        >
                            {intl.getMessage('save_btn')}
                        </Button>
                        <Button
                            variant="secondary"
                            size="small"
                            onClick={handleCancel}
                            data-testid="protection-cancel"
                            class={s.actionButton}
                        >
                            {intl.getMessage('cancel_btn')}
                        </Button>
                    </div>
                </Show>
            </div>
        </div>
    );
};
