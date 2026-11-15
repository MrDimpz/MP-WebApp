import React, { useEffect, useState } from 'react';
import { User as UserIcon } from 'lucide-react';
import {
  getUserProfileAvatarUrl,
  useUnifiedAuth,
  type UnifiedPlayerUser,
  type User,
} from '@/lib/unified-game-auth';

interface UserProfileIconProps {
  user?:
    | UnifiedPlayerUser
    | User
    | { uid?: string; photoURL?: string | null; linkedTikTokHandle?: string | null }
    | null;
  className?: string;
  imgClassName?: string;
  size?: number;
  fallback?: React.ReactNode;
}

export function UserProfileIcon({
  user: propUser,
  className = 'w-4 h-4 shrink-0',
  imgClassName,
  size,
  fallback,
}: UserProfileIconProps) {
  const { user: authUser } = useUnifiedAuth();
  const effectiveUser = propUser !== undefined ? propUser : authUser;
  const [avatarUrl, setAvatarUrl] = useState<string>(() => getUserProfileAvatarUrl(effectiveUser));
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const next = getUserProfileAvatarUrl(effectiveUser);
      setAvatarUrl(next);
      setFailedUrl(null);
    };
    sync();
    window.addEventListener('mp-tiktok-avatar-updated', sync);
    window.addEventListener('mp-tiktok-link-updated', sync);
    window.addEventListener('mp-site-auth-updated', sync);
    return () => {
      window.removeEventListener('mp-tiktok-avatar-updated', sync);
      window.removeEventListener('mp-tiktok-link-updated', sync);
      window.removeEventListener('mp-site-auth-updated', sync);
    };
  }, [
    effectiveUser,
    (effectiveUser as { uid?: string })?.uid,
    (effectiveUser as { photoURL?: string | null })?.photoURL,
    (effectiveUser as { linkedTikTokHandle?: string | null })?.linkedTikTokHandle,
  ]);

  if (avatarUrl && avatarUrl !== failedUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        style={size ? { width: size, height: size } : undefined}
        className={
          imgClassName ||
          `${className} rounded-full object-cover ring-1 ring-[#F6C915]/60 shrink-0`
        }
        referrerPolicy="no-referrer"
        onError={() => setFailedUrl(avatarUrl)}
      />
    );
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  return <UserIcon size={size} className={className} />;
}
