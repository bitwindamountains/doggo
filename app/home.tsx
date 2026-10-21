// `dogyears://home` (nudge deep links) lands on the Home tab.
import { Redirect } from 'expo-router';

export default function HomeLink() {
  return <Redirect href="/" />;
}
