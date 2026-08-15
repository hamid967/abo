import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

type MotionPreference = { reducedMotion: boolean; isReady: boolean };

export function useReducedMotion(): MotionPreference {
  const [preference, setPreference] = useState<MotionPreference>({ reducedMotion: true, isReady: false });

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reducedMotion) => { if (mounted) setPreference({ reducedMotion, isReady: true }); })
      .catch(() => { if (mounted) setPreference({ reducedMotion: false, isReady: true }); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (reducedMotion) => setPreference({ reducedMotion, isReady: true }));
    return () => { mounted = false; subscription.remove(); };
  }, []);

  return preference;
}
