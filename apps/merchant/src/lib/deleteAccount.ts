import { Alert } from 'react-native';
import { supabase } from '../services/supabase';

/** Asks for confirmation, then deletes (anonymises and locks) the signed-in account. */
export function confirmDeleteAccount(): void {
  Alert.alert(
    'Delete account?',
    'This permanently closes your BEVER account and signs you out. Your shop will be closed. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const { error } = await supabase.rpc('delete_my_account');
            if (error) {
              Alert.alert(
                'Could not delete',
                /ACTIVE_ORDER_EXISTS/.test(error.message)
                  ? 'You have an order in progress. Delete your account once it is finished.'
                  : 'Something went wrong. Please try again or contact BEVER support.',
              );
              return;
            }
            await supabase.auth.signOut();
          })();
        },
      },
    ],
  );
}
