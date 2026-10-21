// iOS only: Apple's Family Activity picker for the watched app group. Apple never gives the
// app the names of the picked apps, only opaque tokens (kept natively by id) and counts.

import { router, useLocalSearchParams } from 'expo-router';
import {
  DeviceActivitySelectionSheetViewPersisted,
  activitySelectionMetadata,
  getFamilyActivitySelectionId,
} from 'react-native-device-activity';

import { Screen } from '@/components/Screen';
import { t } from '@/copy';
import { finishAppPicker } from '@/services/screentime/pickerBridge';

export default function PickApps() {
  const { groupId = 'social' } = useLocalSearchParams<{ groupId?: string }>();
  return (
    <Screen title={t('ui.settings.pickApps')}>
      <DeviceActivitySelectionSheetViewPersisted
        familyActivitySelectionId={groupId}
        style={{ width: 1, height: 1, position: 'absolute' }}
        onDismissRequest={() => {
          // Count from the persisted selection, so closing it unchanged keeps the apps.
          const m = getFamilyActivitySelectionId(groupId)
            ? activitySelectionMetadata({ activitySelectionId: groupId })
            : undefined;
          finishAppPicker(m ? m.applicationCount + m.categoryCount + m.webDomainCount : 0);
          router.back();
        }}
      />
    </Screen>
  );
}
