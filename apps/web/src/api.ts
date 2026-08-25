import type { Course, Dashboard, Leaderboard, Member, ResultEntry, ResultType, Task, TaskType, User } from './types';

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
let token = sessionStorage.getItem('bai-token');

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({ message: 'Сервер вернул некорректный ответ' }));
  if (!response.ok) throw new Error(body.message ?? 'Ошибка запроса');
  return body as T;
}

export async function authenticate(initData: string) {
  const result = await request<{ token: string; status: User['status'] }>('/auth/telegram', { method: 'POST', body: JSON.stringify({ initData }) });
  token = result.token; sessionStorage.setItem('bai-token', result.token); return result.status;
}

export const api = {
  bootstrap: () => request<Dashboard>('/bootstrap'),
  addTask: (input: { title: string; type: TaskType; date: string }) => request<Task>('/tasks', { method: 'POST', body: JSON.stringify(input) }),
  setTaskCompleted: (id: string, isCompleted: boolean) => request<{ task: Task; xp: number; streakDays: number }>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ isCompleted }) }),
  deleteTask: (id: string) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),
  askMentor: (question: string) => request<{ answer: string; remaining: number }>('/mentor', { method: 'POST', body: JSON.stringify({ question }) }),
  academy: () => request<Course[]>('/academy'),
  setLessonCompleted: (id: string, isCompleted: boolean) => request<{ progress: { isCompleted: boolean }; xp: number }>(`/academy/lessons/${id}`, { method: 'PATCH', body: JSON.stringify({ isCompleted }) }),
  members: () => request<Member[]>('/members'),
  leaderboard: (period: 'month' | 'all') => request<Leaderboard>(`/leaderboard?period=${period}`),
  connect: (id: string, message?: string) => request<{ contactUrl: string | null }>(`/members/${id}/connect`, { method: 'POST', body: JSON.stringify({ message }) }),
  updateProfile: (input: Partial<Pick<User, 'name' | 'location' | 'occupation' | 'income' | 'goal' | 'giveTags' | 'seekTags'>>) => request<User>('/profile', { method: 'PATCH', body: JSON.stringify(input) }),
  setDiscoverability: (isDiscoverable: boolean) => request<{ isDiscoverable: boolean }>('/profile/discoverability', { method: 'PATCH', body: JSON.stringify({ isDiscoverable }) }),
  addResult: (type: ResultType, value: number, note?: string) => request<ResultEntry>('/results', { method: 'POST', body: JSON.stringify({ type, value, note, clientRequestId: crypto.randomUUID() }) }),
  deleteResult: (id: string) => request<void>(`/results/${id}`, { method: 'DELETE' }),
  setTodayActive: (active: boolean) => request<{ active: boolean; streakDays: number; bestStreak: number }>('/activity/today', { method: 'PUT', body: JSON.stringify({ active }) }),
  bookCurator: (note?: string) => request<{ id: string; status: string }>('/curator-bookings', { method: 'POST', body: JSON.stringify({ note }) }),
};
