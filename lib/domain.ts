import type { GeneratedMesh } from "./catalog";

export type InitiativeStatus =
  | "new"
  | "review"
  | "in_progress"
  | "done"
  | "rejected";

export type Category =
  | "roads"
  | "lighting"
  | "green"
  | "playground"
  | "waste"
  | "housing"
  | "parking"
  | "other";

export type Priority = "urgent" | "high" | "standard";

/** Оперативный дефект или замысел благоустройства. Старые заявки могут не хранить поле. */
export type InitiativeIntent = "defect" | "proposal";

export type Role =
  | "citizen"
  | "admin_staff"
  | "admin_head"
  | "moderator"
  | "superadmin";

export type CitizenLevel = "novice" | "active" | "oldtimer" | "leader" | "voice";

export type CommunityType = "street" | "thematic" | "district";

export type MeetingType = "yard" | "district" | "workgroup" | "open";

export const CATEGORY_LABELS: Record<Category, string> = {
  roads: "Дороги и тротуары",
  lighting: "Освещение",
  green: "Зелёные насаждения",
  playground: "Детские площадки",
  waste: "Мусор и уборка",
  housing: "ЖКХ и коммуникации",
  parking: "Парковка",
  other: "Прочее",
};

export const STATUS_LABELS: Record<InitiativeStatus, string> = {
  new: "Новая",
  review: "На рассмотрении",
  in_progress: "В работе",
  done: "Выполнена",
  rejected: "Отклонена",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "Срочно",
  high: "Высокий",
  standard: "Стандартный",
};

export const LEVEL_LABELS: Record<CitizenLevel, string> = {
  novice: "Новичок",
  active: "Активный житель",
  oldtimer: "Старожил",
  leader: "Лидер мнений",
  voice: "Голос города",
};

export const CATEGORY_SLA_DAYS: Record<Category, number> = {
  lighting: 7,
  waste: 5,
  housing: 14,
  parking: 14,
  playground: 21,
  green: 21,
  roads: 30,
  other: 14,
};

export const POINTS = {
  submit: 10,
  submitWithViz: 15,
  vote: 2,
  comment: 3,
  photoAfter: 5,
  daily: 1,
} as const;

export interface District {
  id: string;
  name: string;
  center: [number, number];
  polygon: [number, number][];
}

export interface User {
  id: string;
  name: string;
  nickname: string;
  role: Role;
  districtId: string;
  points: number;
  avatarHue: number;
  achievements: string[];
  joinedAt: string;
}

export interface StatusEvent {
  at: string;
  status: InitiativeStatus;
  comment: string;
  authorId: string;
  photoAfter?: boolean;
}

export interface Comment {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
}

/** One object frozen with the 3D sketch so the scene can be reopened. */
export interface ScenePlacement {
  kind: string;
  label: string;
  price: number;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  floors?: number;
  use?: "residential" | "commercial" | "mixed";
  catalogId?: string;
  mesh?: GeneratedMesh;
  sketch?: boolean;
  article?: string;
  manufacturer?: string;
  material?: string;
  colorName?: string;
  weightKg?: number;
  lengthM?: number;
  widthM?: number;
  heightM?: number;
}

export interface Visualization {
  objectCount: number;
  cost: number;
  note: string;
  createdAt: string;
  lng: number;
  lat: number;
  /** Placed objects with pose. Missing on sketches saved before this field existed. */
  placements?: ScenePlacement[];
}

export interface Initiative {
  id: string;
  title: string;
  description: string;
  reformulated?: string;
  category: Category;
  categoryConfidence: number;
  intent?: InitiativeIntent;
  priority: Priority;
  status: InitiativeStatus;
  lng: number;
  lat: number;
  address: string;
  districtId: string;
  authorId: string;
  assignee: string;
  photos: string[];
  votes: string[];
  comments: Comment[];
  history: StatusEvent[];
  visualization?: Visualization;
  createdAt: string;
  dueAt: string;
}

export interface Community {
  id: string;
  type: CommunityType;
  name: string;
  members: number;
  description: string;
  districtId?: string;
}

export interface Meeting {
  id: string;
  title: string;
  type: MeetingType;
  initiativeId?: string;
  when: string;
  agenda: string;
  participants: number;
  maxParticipants: number;
  hostId: string;
}

export interface AssistResult {
  category: Category;
  categoryConfidence: number;
  reformulated: string;
  priority: Priority;
  isValid: boolean;
  validationHint: string | null;
  similarIds: string[];
  mock: boolean;
}

export interface AchievementDef {
  id: string;
  title: string;
  condition: string;
}
