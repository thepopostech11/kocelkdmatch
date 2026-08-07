export type DerivAccount = {
  loginid: string;
  currency: string;
  accountType: string;
  isVirtual: boolean;
  balance: number;
};

export type ConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "error";

export type NotificationKind =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "trade"
  | "bot"
  | "connection";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  message?: string;
  createdAt: number;
  read: boolean;
};

export type ThemeMode = "dark" | "light" | "system";
