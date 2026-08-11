export const DEFAULT_AVATAR_COLOR = "teal";

export const avatarColorOptions = [
  { value: "teal", label: "珊瑚", swatchClass: "bg-avatar-coral", avatarClass: "bg-avatar-coral text-surface" },
  { value: "coral", label: "砖红", swatchClass: "bg-avatar-brick", avatarClass: "bg-avatar-brick text-surface" },
  { value: "amber", label: "赭黄", swatchClass: "bg-avatar-ochre", avatarClass: "bg-avatar-ochre text-ink" },
  { value: "sky", label: "橄榄", swatchClass: "bg-avatar-olive", avatarClass: "bg-avatar-olive text-surface" },
  { value: "violet", label: "石青", swatchClass: "bg-avatar-slate", avatarClass: "bg-avatar-slate text-surface" },
  { value: "rose", label: "藕紫", swatchClass: "bg-avatar-mauve", avatarClass: "bg-avatar-mauve text-surface" },
] as const;

export type AvatarColor = (typeof avatarColorOptions)[number]["value"];

export function isAvatarColor(value: unknown): value is AvatarColor {
  return avatarColorOptions.some((option) => option.value === value);
}

export function normalizeAvatarColor(value: unknown): AvatarColor {
  return isAvatarColor(value) ? value : DEFAULT_AVATAR_COLOR;
}

export function avatarColorClass(value: unknown) {
  return (
    avatarColorOptions.find((option) => option.value === value)?.avatarClass ??
    avatarColorOptions[0].avatarClass
  );
}
