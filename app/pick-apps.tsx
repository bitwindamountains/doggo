// iOS only: Apple's Family Activity picker for the watched app group. Apple never gives the
// app the names of the picked apps, only opaque tokens (kept natively by id) and counts.

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { DeviceActivitySelectionSheetViewPersisted } from 'react-native-device-activity';

import { Screen } from '@/components/Screen';
import { t } from '@/copy';
import { finishAppPicker } from '@/services/screentime/pickerBridge';

export default function PickApps() {
  const { groupId = 'social' } = useLocalSearchParams<{ groupId?: string }>();
  const [count, setCount] = useState(0);
  return (
    <Screen title={t('ui.settings.pickApps')}>
      <DeviceActivitySelectionSheetViewPersisted
        familyActivitySelectionId={groupId}
        style={{ width: 1, height: 1, position: 'absolute' }}
        onSelectionChange={(e) => {
          const m = e.nativeEvent;
          setCount(m.applicationCount + m.categoryCount + m.webDomainCount);
        }}
        onDismissRequest={() => {
          finishAppPicker(count);
          router.back();
        }}
      />
    </Screen>
  );
}
