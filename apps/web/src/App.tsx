import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, RefreshCw, X } from 'lucide-react';
import { BottomNav, Toast } from './components';
import { api, authenticate } from './api';
import { demoDashboard, demoLeaderboard, demoMembers } from './demo';
import { AcademyScreen } from './screens/AcademyScreen';
import { HomeScreen } from './screens/HomeScreen';
import { MentorScreen } from './screens/MentorScreen';
import { PeopleScreen } from './screens/PeopleScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import type { ContentKind, Dashboard, Leaderboard, Member, NavKey, ResultEntry, ResultType, Task, TaskType, User } from './types';

const contentTitles: Record<ContentKind, string> = { live: 'Эфиры', article: 'Статьи', podcast: 'Подкаст', community: 'Комьюнити', roadmap: 'Роудмэп', event: 'События' };

function LoadingScreen() { return <div className="system-screen"><span className="brand">BAI.PROD</span><div className="loader" /><h1>Собираем твой маршрут</h1><p>Загружаем прогресс, задачи и материалы.</p></div>; }
function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="system-screen"><span className="brand">BAI.PROD</span><h1>Не удалось открыть приложение</h1><p>{message}</p><button className="primary" onClick={onRetry}><RefreshCw size={17} />Повторить</button><small>Открой Mini App из актуальной кнопки Telegram-бота.</small></div>; }

export function App() {
  const [nav, setNav] = useState<NavKey>('home');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [mode, setMode] = useState<'api' | 'demo' | null>(null);
  const [error, setError] = useState(''); const [toast, setToast] = useState('');
  const [members, setMembers] = useState<Member[]>([]); const [leaderboard, setLeaderboard] = useState<Leaderboard>(demoLeaderboard);
  const [contentKind, setContentKind] = useState<ContentKind | null>(null);

  const load = useCallback(async () => {
    setError(''); setDashboard(null);
    const initData = window.Telegram?.WebApp.initData;
    if (!initData) {
      if (import.meta.env.DEV) { setDashboard(demoDashboard); setMembers(demoMembers); setMode('demo'); return; }
      setError('Telegram не передал данные авторизации.'); return;
    }
    try { await authenticate(initData); const data = await api.bootstrap(); setDashboard(data); setMode('api'); setMembers(await api.members()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'API временно недоступен'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 2800); return () => window.clearTimeout(timer); }, [toast]);

  const loadLeaderboard = useCallback(async (period: 'month' | 'all') => {
    if (mode === 'api') {
      try { setLeaderboard(await api.leaderboard(period)); }
      catch (cause) { setToast(cause instanceof Error ? cause.message : 'Рейтинг недоступен'); }
      return;
    }
    const currentXp = dashboard?.user.xp ?? 0;
    setLeaderboard(period === 'month' ? demoLeaderboard : { ...demoLeaderboard, leaders: demoLeaderboard.leaders.map(item => ({ ...item, score: item.score * 3 })), me: { ...demoLeaderboard.me, score: currentXp } });
  }, [dashboard?.user.xp, mode]);

  const run = async (action: () => Promise<void>, failure = 'Не удалось сохранить изменения') => {
    try {
      await action();
      return true;
    } catch (cause) {
      setToast(cause instanceof Error ? cause.message : failure);
      return false;
    }
  };
  if (error) return <ErrorScreen message={error} onRetry={() => void load()} />;
  if (!dashboard || !mode) return <LoadingScreen />;

  const toggleTask = async (task: Task) => {
    const desired = !task.isCompleted; const previous = dashboard;
    setDashboard(current => current ? { ...current, user: { ...current.user, xp: current.user.xp + (desired ? task.xpReward : -task.xpReward) }, tasks: current.tasks.map(item => item.id === task.id ? { ...item, isCompleted: desired } : item) } : current);
    if (window.Telegram?.WebApp.initData) window.Telegram.WebApp.HapticFeedback?.impactOccurred('light');
    if (mode === 'api') try { const result = await api.setTaskCompleted(task.id, desired); setDashboard(current => current ? { ...current, user: { ...current.user, xp: result.xp, streakDays: result.streakDays }, tasks: current.tasks.map(item => item.id === task.id ? result.task : item) } : current); } catch (cause) { setDashboard(previous); setToast(cause instanceof Error ? cause.message : 'Не удалось сохранить задачу'); return; }
    setToast(desired ? (task.xpReward > 0 ? `+${task.xpReward} XP начислено` : 'Задача выполнена · дневной лимит XP исчерпан') : (task.xpReward > 0 ? 'XP возвращён' : 'Отметка снята'));
  };
  const addTask = async (title: string, type: TaskType, date: string) => run(async () => {
    const limits: Record<TaskType, number> = { main: 1, medium: 3, small: 5 };
    const rewards: Record<TaskType, number> = { main: 15, medium: 10, small: 5 };
    const sameDateCount = dashboard.tasks.filter(task => task.type === type && new Date(task.date).toDateString() === new Date(date).toDateString()).length;
    const task = mode === 'api' ? await api.addTask({ title, type, date }) : { id: crypto.randomUUID(), title, type, date, isCompleted: false, xpReward: sameDateCount < limits[type] ? rewards[type] : 0 };
    setDashboard(current => current ? { ...current, tasks: [...current.tasks, task] } : current); setToast('Задача добавлена');
  });
  const deleteTask = async (task: Task) => { if (!window.confirm(`Удалить задачу «${task.title}»?`)) return; await run(async () => { if (mode === 'api') await api.deleteTask(task.id); setDashboard(current => current ? { ...current, tasks: current.tasks.filter(item => item.id !== task.id), user: { ...current.user, xp: current.user.xp - (task.isCompleted ? task.xpReward : 0) } } : current); setToast('Задача удалена'); }); };
  const askMentor = async (question: string) => {
    if (mode === 'api') { const result = await api.askMentor(question); setDashboard(current => current ? { ...current, aiRemaining: result.remaining } : current); return result; }
    await new Promise(resolve => window.setTimeout(resolve, 500)); const remaining = Math.max(0, dashboard.aiRemaining - 1); setDashboard(current => current ? { ...current, aiRemaining: remaining } : current); return { answer: `Сфокусируйся на одном проверяемом результате. Для запроса «${question}» следующий шаг: сегодня покажи свою гипотезу трём потенциальным клиентам.`, remaining };
  };
  const completeLesson = async (lesson: Dashboard['courses'][number]['lessons'][number], completed: boolean) => run(async () => {
    const xp = mode === 'api' ? (await api.setLessonCompleted(lesson.id, completed)).xp : dashboard.user.xp + (completed ? lesson.xpReward : -lesson.xpReward);
    setDashboard(current => current ? { ...current, user: { ...current.user, xp }, courses: current.courses.map(course => ({ ...course, lessons: course.lessons.map(item => item.id === lesson.id ? { ...item, isCompleted: completed } : item) })), stats: { ...current.stats, completedLessons: current.stats.completedLessons + (completed ? 1 : -1) } } : current); setToast(completed ? `Урок завершён · +${lesson.xpReward} XP` : 'Отметка снята');
  });
  const updateProfile = async (input: Partial<User>) => run(async () => { const user = mode === 'api' ? await api.updateProfile(input) : { ...dashboard.user, ...input }; setDashboard(current => current ? { ...current, user: { ...current.user, ...user } } : current); setToast('Профиль обновлён'); });
  const onService = (key: string) => { if (key === 'course') return setNav('academy'); if (key === 'niche') { setNav('profile'); setToast('Заполни профиль — наставник подберёт направление'); return; } setContentKind(key as ContentKind); };
  const connect = async (member: Member) => run(async () => { const result = mode === 'api' ? await api.connect(member.id) : { contactUrl: member.username ? `https://t.me/${member.username}` : null }; setToast('Запрос отправлен'); if (result.contactUrl) { if (window.Telegram?.WebApp.openTelegramLink) window.Telegram.WebApp.openTelegramLink(result.contactUrl); else window.open(result.contactUrl, '_blank', 'noopener,noreferrer'); } });
  const addResult = async (type: ResultType, value: number, note?: string) => run(async () => { const entry = mode === 'api' ? await api.addResult(type, value, note) : { id: crypto.randomUUID(), type, value, note, xpReward: type === 'client' ? 30 : type === 'income' ? 20 : type === 'review' ? 15 : 10, createdAt: new Date().toISOString() }; setDashboard(current => current ? { ...current, results: [entry, ...current.results], user: { ...current.user, xp: current.user.xp + entry.xpReward } } : current); setToast(`Результат добавлен · +${entry.xpReward} XP`); });
  const deleteResult = async (entry: ResultEntry) => run(async () => { if (mode === 'api') await api.deleteResult(entry.id); setDashboard(current => current ? { ...current, results: current.results.filter(item => item.id !== entry.id), user: { ...current.user, xp: current.user.xp - entry.xpReward } } : current); setToast('Запись удалена'); });
  const setToday = async (active: boolean) => run(async () => { const result = mode === 'api' ? await api.setTodayActive(active) : { active, streakDays: active ? dashboard.user.streakDays + 1 : Math.max(0, dashboard.user.streakDays - 1), bestStreak: Math.max(dashboard.user.bestStreak, dashboard.user.streakDays + 1) }; const today = new Date().toISOString(); setDashboard(current => current ? { ...current, user: { ...current.user, streakDays: result.streakDays, bestStreak: result.bestStreak }, activities: active ? [...current.activities.filter(item => new Date(item.date).toDateString() !== new Date().toDateString()), { id: crypto.randomUUID(), date: today, score: 1 }] : current.activities.filter(item => new Date(item.date).toDateString() !== new Date().toDateString()) } : current); });
  const book = async (note?: string) => run(async () => { if (mode === 'api') await api.bookCurator(note); setToast('Заявка отправлена куратору'); });

  const activeContent = contentKind ? dashboard.content.filter(item => item.kind === contentKind) : [];
  return <div className="app-shell"><main>
    {dashboard.user.status === 'pending' ? <div className="pending-banner">Анкета на модерации · базовые функции уже доступны</div> : null}
    {nav === 'home' ? <HomeScreen dashboard={dashboard} onToggle={task => void toggleTask(task)} onAdd={(...args) => void addTask(...args)} onDelete={task => void deleteTask(task)} onService={onService} /> : null}
    {nav === 'academy' ? <AcademyScreen courses={dashboard.courses} onComplete={completeLesson} /> : null}
    {nav === 'mentor' ? <MentorScreen remaining={dashboard.aiRemaining} onAsk={askMentor} /> : null}
    {nav === 'people' ? <PeopleScreen user={dashboard.user} members={members} leaderboard={leaderboard} onLoadLeaderboard={loadLeaderboard} onVisibility={value => void run(async () => { if (mode === 'api') await api.setDiscoverability(value); setDashboard(current => current ? { ...current, user: { ...current.user, isDiscoverable: value } } : current); })} onProfile={input => void updateProfile(input)} onConnect={member => void connect(member)} /> : null}
    {nav === 'profile' ? <ProfileScreen user={dashboard.user} results={dashboard.results} activities={dashboard.activities} stats={dashboard.stats} onProfile={input => void updateProfile(input)} onToday={active => void setToday(active)} onResult={(...args) => void addResult(...args)} onDeleteResult={entry => void deleteResult(entry)} onBook={note => void book(note)} /> : null}
  </main><BottomNav active={nav} onChange={setNav} />{toast ? <Toast message={toast} /> : null}
    {contentKind ? <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setContentKind(null)}><div className="content-sheet"><button className="sheet-close" onClick={() => setContentKind(null)} aria-label="Закрыть"><X size={19} /></button><span className="eyebrow">BAI.PROD</span><h2>{contentTitles[contentKind]}</h2>{activeContent.length ? activeContent.map(item => <article key={item.id}><strong>{item.title}</strong><p>{item.description}</p>{item.url ? <a className="ghost" href={item.url} target="_blank" rel="noreferrer">Открыть <ArrowRight size={16} /></a> : <small>Материал доступен внутри приложения</small>}</article>) : <p className="empty-state">Новые материалы уже готовятся.</p>}</div></div> : null}
  </div>;
}
