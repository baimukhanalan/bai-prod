export type TaskType = 'main' | 'medium' | 'small';
export type ResultType = 'income' | 'client' | 'call' | 'review';
export type ContentKind = 'live' | 'article' | 'podcast' | 'community' | 'roadmap' | 'event';
export type Access = 'free' | 'full' | 'vip';
export type Task = { id: string; title: string; type: TaskType; date: string; isCompleted: boolean; xpReward: number };
export type User = {
  id: string; telegramId: string; name: string; username: string; location: string; occupation: string; income: string; goal: string;
  giveTags: string[]; seekTags: string[]; isDiscoverable: boolean; status: 'pending' | 'approved' | 'blocked'; access: Access;
  xp: number; monthlyXp: number; streakDays: number; bestStreak: number; level: string;
};
export type ResultEntry = { id: string; type: ResultType; value: number | string; note?: string; xpReward: number; createdAt: string };
export type ActivityDay = { id: string; date: string; score: number };
export type Lesson = { id: string; slug: string; title: string; description?: string; body?: string; kind: 'video' | 'audio' | 'text'; durationMinutes: number; contentUrl?: string; sortOrder: number; xpReward: number; isCompleted: boolean };
export type Course = { id: string; slug: string; title: string; description: string; access: Access; locked: boolean; lessons: Lesson[] };
export type ContentItem = { id: string; kind: ContentKind; title: string; description?: string; url?: string; startsAt?: string };
export type Stats = { completedTasks: number; completedLessons: number };
export type Dashboard = { user: User; tasks: Task[]; results: ResultEntry[]; aiRemaining: number; activities: ActivityDay[]; courses: Course[]; content: ContentItem[]; stats: Stats; serverTime: string };
export type Member = { id: string; name: string; username?: string; location?: string; occupation?: string; goal?: string; giveTags: string[]; seekTags: string[] };
export type Leader = { id?: string; name?: string; username?: string; score: number };
export type Leaderboard = { leaders: Leader[]; me: { id: string; name?: string; score: number; position: number } };
export type NavKey = 'home' | 'academy' | 'mentor' | 'people' | 'profile';

