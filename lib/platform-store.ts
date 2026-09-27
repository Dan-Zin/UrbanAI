"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  CATEGORY_LABELS,
  CATEGORY_SLA_DAYS,
  POINTS,
  type Category,
  type Community,
  type Initiative,
  type InitiativeIntent,
  type InitiativeStatus,
  type Meeting,
  type Priority,
  type Role,
  type User,
  type Visualization,
} from "./domain";
import type { SiteView } from "./views";
import { classifyIntent } from "./views";
import { upsertView } from "@/services/views";
import {
  DISTRICTS,
  USERS,
  INITIATIVES,
  COMMUNITIES,
  MEETINGS,
  DEMO_USER_ID,
  EMBANKMENT_PLACEMENTS,
} from "./seed";
import { addDays, findDistrict, reverseGeocode, routeAssignee } from "./geo";
import { unlockedAchievements } from "./gamification";
import { mockAssist, similarInitiatives } from "./ai-assist";

export type RoleView = Extract<Role, "citizen" | "admin_staff" | "admin_head">;

interface CreateDraft {
  title: string;
  description: string;
  lng: number;
  lat: number;
  visualization?: Visualization;
  intent?: InitiativeIntent;
}

interface PlatformState {
  users: User[];
  initiatives: Initiative[];
  communities: Community[];
  meetings: Meeting[];
  views: SiteView[];
  currentUserId: string;
  roleView: RoleView;
  setRoleView: (role: RoleView) => void;
  setCurrentUser: (id: string) => void;
  currentUser: () => User;
  createInitiative: (draft: CreateDraft) => Initiative;
  voteInitiative: (id: string) => void;
  commentInitiative: (id: string, text: string) => void;
  changeStatus: (id: string, status: InitiativeStatus, comment: string, photoAfter?: boolean) => void;
  attachVisualization: (id: string, viz: Visualization) => void;
  saveView: (view: SiteView) => void;
  joinMeeting: (id: string) => void;
  createMeeting: (payload: Omit<Meeting, "id" | "participants" | "hostId">) => Meeting;
  resetDemo: () => void;
}

function nid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function award(users: User[], userId: string, points: number): User[] {
  return users.map((u) => (u.id === userId ? { ...u, points: u.points + points } : u));
}

function syncAchievements(users: User[], initiatives: Initiative[]): User[] {
  return users.map((u) => ({
    ...u,
    achievements: unlockedAchievements(u, initiatives),
  }));
}

function initial() {
  return {
    users: USERS,
    initiatives: INITIATIVES,
    communities: COMMUNITIES,
    meetings: MEETINGS,
    views: [] as SiteView[],
    currentUserId: DEMO_USER_ID,
    roleView: "citizen" as RoleView,
  };
}

export const usePlatform = create<PlatformState>()(
  persist(
    (set, get) => ({
      ...initial(),
      setRoleView: (roleView) => set({ roleView }),
      setCurrentUser: (currentUserId) => set({ currentUserId }),
      currentUser: () => {
        const { users, currentUserId } = get();
        return users.find((u) => u.id === currentUserId) ?? users[0];
      },
      createInitiative: (draft) => {
        const district = findDistrict(draft.lng, draft.lat, DISTRICTS);
        const address = reverseGeocode(draft.lng, draft.lat);
        const similar = similarInitiatives(draft.description, district.id, get().initiatives);
        const assist = mockAssist(draft.description, address, similar);
        const now = new Date().toISOString();
        const category: Category = assist.category;
        const priority: Priority = assist.priority;
        const item: Initiative = {
          id: nid("in"),
          title: draft.title.trim() || assist.reformulated.slice(0, 72),
          description: draft.description.trim(),
          reformulated: assist.reformulated,
          category,
          categoryConfidence: assist.categoryConfidence,
          priority,
          status: "new",
          lng: draft.lng,
          lat: draft.lat,
          address,
          districtId: district.id,
          authorId: get().currentUserId,
          assignee: routeAssignee(district.name, CATEGORY_LABELS[category]),
          photos: ["photo"],
          votes: [],
          comments: [],
          history: [
            {
              at: now,
              status: "new",
              comment: "Заявка создана",
              authorId: get().currentUserId,
            },
          ],
          visualization: draft.visualization,
          intent: draft.intent ?? classifyIntent(draft.title, draft.description),
          createdAt: now,
          dueAt: addDays(now, CATEGORY_SLA_DAYS[category]),
        };
        set((s) => {
          const initiatives = [item, ...s.initiatives];
          const points = draft.visualization ? POINTS.submitWithViz : POINTS.submit;
          const users = syncAchievements(award(s.users, s.currentUserId, points), initiatives);
          return { initiatives, users };
        });
        return item;
      },
      voteInitiative: (id) =>
        set((s) => {
          const already = s.initiatives.find((i) => i.id === id)?.votes.includes(s.currentUserId);
          if (already) return s;
          const initiatives = s.initiatives.map((i) =>
            i.id === id ? { ...i, votes: [...i.votes, s.currentUserId] } : i
          );
          return {
            initiatives,
            users: syncAchievements(award(s.users, s.currentUserId, POINTS.vote), initiatives),
          };
        }),
      commentInitiative: (id, text) =>
        set((s) => {
          const comment = {
            id: nid("c"),
            authorId: s.currentUserId,
            text: text.trim(),
            createdAt: new Date().toISOString(),
          };
          const initiatives = s.initiatives.map((i) =>
            i.id === id ? { ...i, comments: [...i.comments, comment] } : i
          );
          return {
            initiatives,
            users: syncAchievements(award(s.users, s.currentUserId, POINTS.comment), initiatives),
          };
        }),
      changeStatus: (id, status, comment, photoAfter) =>
        set((s) => {
          const now = new Date().toISOString();
          const initiatives = s.initiatives.map((i) => {
            if (i.id !== id) return i;
            return {
              ...i,
              status,
              history: [
                ...i.history,
                {
                  at: now,
                  status,
                  comment,
                  authorId: s.currentUserId,
                  photoAfter,
                },
              ],
            };
          });
          let users = s.users;
          if (photoAfter) users = award(users, s.currentUserId, POINTS.photoAfter);
          users = syncAchievements(users, initiatives);
          return { initiatives, users };
        }),
      saveView: (view) => set((s) => ({ views: upsertView(s.views, view) })),
      attachVisualization: (id, visualization) =>
        set((s) => {
          const initiatives = s.initiatives.map((i) =>
            i.id === id ? { ...i, visualization } : i
          );
          return {
            initiatives,
            users: syncAchievements(s.users, initiatives),
          };
        }),
      joinMeeting: (id) =>
        set((s) => ({
          meetings: s.meetings.map((m) =>
            m.id === id && m.participants < m.maxParticipants
              ? { ...m, participants: m.participants + 1 }
              : m
          ),
        })),
      createMeeting: (payload) => {
        const meeting: Meeting = {
          ...payload,
          id: nid("mt"),
          participants: 1,
          hostId: get().currentUserId,
        };
        set((s) => ({ meetings: [meeting, ...s.meetings] }));
        return meeting;
      },
      resetDemo: () => set(initial()),
    }),
    {
      name: "tochka-rosta-demo-v2",
      version: 1,
      migrate: (persisted, version) => {
        if (version >= 1) return persisted as never;
        const state = persisted as {
          initiatives?: { id: string; visualization?: { placements?: unknown[] } }[];
        };
        if (!state?.initiatives) return persisted as never;
        return {
          ...state,
          initiatives: state.initiatives.map((item) => {
            if (item.id !== "in-03" || !item.visualization || item.visualization.placements?.length) {
              return item;
            }
            return {
              ...item,
              visualization: {
                ...item.visualization,
                objectCount: EMBANKMENT_PLACEMENTS.length,
                placements: EMBANKMENT_PLACEMENTS,
              },
            };
          }),
        } as never;
      },
    }
  )
);

export function useHasHydrated() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}
