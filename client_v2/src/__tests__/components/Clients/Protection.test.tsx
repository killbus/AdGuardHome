import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@solidjs/testing-library';
import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router';

const dashboardMocks = vi.hoisted(() => ({
    getClients: vi.fn(),
    dashboardState: {
        clients: [] as unknown[],
        supportedTags: [] as string[],
    },
}));

const apiMocks = vi.hoisted(() => ({
    clientsUpdate: vi.fn(),
    clientsAdd: vi.fn(),
}));

vi.mock('panel/stores/dashboard', () => ({
    dashboardState: {
        get clients() {
            return dashboardMocks.dashboardState.clients;
        },
        get supportedTags() {
            return dashboardMocks.dashboardState.supportedTags;
        },
    },
    getClients: dashboardMocks.getClients,
}));

vi.mock('panel/api/generated', () => ({
    clientsUpdate: apiMocks.clientsUpdate,
    clientsAdd: apiMocks.clientsAdd,
}));

vi.mock('panel/common/intl', async () =>
    (await import('panel/__tests__/helpers/copy')).createIntlMock(),
);

import { Protection } from 'panel/components/Clients/AddClient/blocks/Protection/Protection';
import { clearClientForm, clientFormState } from 'panel/stores/clientForm';

// jsdom has no matchMedia; the theme hook depends on it.
beforeAll(() => {
    if (!window.matchMedia) {
        window.matchMedia = (query: string) =>
            ({
                matches: false,
                media: query,
                onchange: null,
                addEventListener: () => {},
                removeEventListener: () => {},
                addListener: () => {},
                removeListener: () => {},
                dispatchEvent: () => false,
            }) as unknown as MediaQueryList;
    }
});

const laptop = {
    name: 'Laptop',
    ids: ['192.168.1.1'],
    filtering_enabled: true,
    safebrowsing_enabled: false,
    parental_enabled: false,
};

const renderProtection = (path: string) => {
    const history = createMemoryHistory();
    history.set({ value: path });

    render(() => (
        <MemoryRouter history={history}>
            <Route path="/clients/edit/:clientName/protection" component={Protection} />
            <Route path="/clients" component={() => <div data-testid="clients-page" />} />
            <Route path="/clients/add" component={() => <div data-testid="clients-add-page" />} />
            <Route
                path="/clients/edit/:clientName"
                component={() => <div data-testid="clients-edit-page" />}
            />
        </MemoryRouter>
    ));

    return { history };
};

const setToggle = (id: string, checked: boolean) => {
    const input = document.getElementById(id) as HTMLInputElement;
    input.checked = checked;
    input.dispatchEvent(new Event('change', { bubbles: true }));
};

describe('Protection sub-page', () => {
    beforeEach(() => {
        clearClientForm();
        apiMocks.clientsUpdate.mockReset();
        apiMocks.clientsAdd.mockReset();
        apiMocks.clientsUpdate.mockResolvedValue(undefined);
        dashboardMocks.dashboardState.clients = [laptop];
    });

    it('initializes the form from the route client and shows save/cancel actions', async () => {
        renderProtection('/clients/edit/Laptop/protection');

        await waitFor(() => {
            expect(clientFormState.mode).toBe('edit');
        });

        expect(screen.getByTestId('protection-save')).toBeInTheDocument();
        expect(screen.getByTestId('protection-cancel')).toBeInTheDocument();
    });

    it('persists the Browsing security toggle when Save is clicked', async () => {
        renderProtection('/clients/edit/Laptop/protection');

        await waitFor(() => {
            expect(clientFormState.mode).toBe('edit');
        });

        setToggle('safebrowsing-enabled', true);
        expect(clientFormState.safebrowsing_enabled).toBe(true);

        await screen.getByTestId('protection-save').click();

        await waitFor(() => {
            expect(apiMocks.clientsUpdate).toHaveBeenCalledOnce();
        });

        const call = apiMocks.clientsUpdate.mock.calls[0][0];
        expect(call.name).toBe('Laptop');
        expect(call.data.safebrowsing_enabled).toBe(true);

        await waitFor(() => {
            expect(screen.getByTestId('clients-page')).toBeInTheDocument();
        });
    });

    it('discards local changes and returns to the edit page on cancel', async () => {
        renderProtection('/clients/edit/Laptop/protection');

        await waitFor(() => {
            expect(clientFormState.mode).toBe('edit');
        });

        setToggle('parental-enabled', true);
        expect(clientFormState.parental_enabled).toBe(true);

        await screen.getByTestId('protection-cancel').click();

        await waitFor(() => {
            expect(screen.getByTestId('clients-edit-page')).toBeInTheDocument();
        });
        expect(clientFormState.mode).toBe('add');
    });
});
