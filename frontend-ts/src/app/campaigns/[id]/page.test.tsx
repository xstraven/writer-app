import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';

// Mock React.use() for Next.js 16 async params support
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof React>('react');
  return {
    ...actual,
    use: vi.fn((promise: Promise<any>) => {
      // In tests, we need to synchronously unwrap the Promise
      // This simulates the behavior of React.use() in a test environment
      let result: any;
      promise.then((value) => { result = value; });
      // Force synchronous resolution for testing
      if (result === undefined) {
        throw promise; // Suspend if not resolved
      }
      return result;
    }),
  };
});

// Mock the AdventureView component
vi.mock('@/components/rpg/AdventureView', () => ({
  AdventureView: ({ campaignId }: { campaignId: string }) => (
    <div data-testid="adventure-view">Adventure View for campaign: {campaignId}</div>
  ),
}));

// Import after mocks are set up
const CampaignPage = (await import('./page')).default;

describe('CampaignPage - Next.js 16 Async Params Regression Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly unwraps Promise params using React.use() (Next.js 16)', async () => {
    // Next.js 16 passes params as a Promise - this is the key regression test
    // If the component tries to access params.id directly without React.use(),
    // it will fail with "params.id is undefined" or "params is a Promise"

    const mockParams = Promise.resolve({ id: 'test-campaign-123' });

    // Mock React.use to synchronously return the resolved value
    const mockUse = vi.mocked(React.use);
    mockUse.mockImplementation((promise: any) => {
      if (promise === mockParams) {
        return { id: 'test-campaign-123' };
      }
      return promise;
    });

    render(<CampaignPage params={mockParams} />);

    // Verify React.use() was called with the params Promise
    expect(mockUse).toHaveBeenCalledWith(mockParams);

    // Verify the component rendered with the unwrapped ID
    await waitFor(() => {
      expect(screen.getByTestId('adventure-view')).toBeInTheDocument();
    });
    expect(screen.getByText(/Adventure View for campaign: test-campaign-123/i)).toBeInTheDocument();
  });

  it('handles different campaign IDs from async params', async () => {
    const mockParams = Promise.resolve({ id: 'another-campaign-456' });

    const mockUse = vi.mocked(React.use);
    mockUse.mockImplementation((promise: any) => {
      if (promise === mockParams) {
        return { id: 'another-campaign-456' };
      }
      return promise;
    });

    render(<CampaignPage params={mockParams} />);

    expect(mockUse).toHaveBeenCalledWith(mockParams);

    await waitFor(() => {
      expect(screen.getByTestId('adventure-view')).toBeInTheDocument();
    });
    expect(screen.getByText(/Adventure View for campaign: another-campaign-456/i)).toBeInTheDocument();
  });

  it('maintains correct layout structure', async () => {
    const mockParams = Promise.resolve({ id: 'test-id' });

    const mockUse = vi.mocked(React.use);
    mockUse.mockImplementation((promise: any) => {
      if (promise === mockParams) {
        return { id: 'test-id' };
      }
      return promise;
    });

    const { container } = render(<CampaignPage params={mockParams} />);

    await waitFor(() => {
      expect(screen.getByTestId('adventure-view')).toBeInTheDocument();
    });

    // Verify the layout structure
    const mainDiv = container.querySelector('.min-h-screen.bg-background');
    expect(mainDiv).toBeInTheDocument();

    const contentDiv = container.querySelector('.max-w-7xl.mx-auto');
    expect(contentDiv).toBeInTheDocument();
  });
});
