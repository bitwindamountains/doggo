import { render, screen } from '@testing-library/react-native';

import { PlaceholderScreen } from '../PlaceholderScreen';

describe('PlaceholderScreen', () => {
  it('renders the title as a header and the note', async () => {
    await render(<PlaceholderScreen title="Home" note="The dog lives here." />);
    expect(screen.getByRole('header', { name: 'Home' })).toBeTruthy();
    expect(screen.getByText('The dog lives here.')).toBeTruthy();
  });
});
