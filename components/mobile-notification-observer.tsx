import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

function taskRouteFromNotification(notification: Notifications.Notification) {
  const url = notification.request.content.data?.url;
  return url === "/task-tracking" ? url : undefined;
}

/** Opens only the allow-listed task screen when the user explicitly taps a task alert. */
export function MobileNotificationObserver() {
  const router = useRouter();
  useEffect(() => {
    if (Platform.OS === "web") return;
    const open = (notification: Notifications.Notification) => {
      const route = taskRouteFromNotification(notification);
      if (route) router.push(route as never);
    };
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response?.notification) open(response.notification);
    });
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => open(response.notification));
    return () => subscription.remove();
  }, [router]);
  return null;
}
