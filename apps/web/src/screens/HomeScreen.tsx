import { useMemo, useState } from 'react';
import {
  ArrowRight, CalendarDots, Check, Compass, FileText, Headphones, MicrophoneStage,
  Play, Plus, Sparkle, Trash, TrendUp, UsersThree,
} from '@phosphor-icons/react';
import { SectionTitle, Segmented } from '../components';
import type { Dashboard, Task, TaskType } from '../types';

const services = [
  { key: 'course', label: 'Мини-курс', icon: Play },
  { key: 'niche', label: 'Подбор ниши', icon: Compass },
  { key: 'live', label: 'Эфиры', icon: MicrophoneStage },
  { key: 'article', label: 'Статьи', icon: FileText },
  { key: 'podcast', label: 'Подкаст', icon: Headphones },
  { key: 'community', label: 'Комьюнити', icon: UsersThree },
  { key: 'roadmap', label: 'Роудмэп', icon: TrendUp },
  { key: 'event', label: 'Предстоящие события', icon: CalendarDots },
];

const groups: { type: TaskType; label: string; empty: string; limit: number; xp: number }[] = [
  { type: 'main', label: 'Главная', empty: 'Главная задача дня не выбрана', limit: 1, xp: 15 },
  { type: 'medium', label: 'Средние', empty: 'Средних задач нет', limit: 3, xp: 10 },
  { type: 'small', label: 'Маленькие', empty: 'Маленьких задач нет', limit: 5, xp: 5 },
];

function sameDay(a: string, b: Date) {
  const date = new Date(a);
  return date.toDateString() === b.toDateString();
}

function currentDateLabel() {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date()).toUpperCase();
}

export function HomeScreen({ dashboard, onToggle, onAdd, onDelete, onService }: {
  dashboard: Dashboard;
  onToggle: (task: Task) => void;
  onAdd: (title: string, type: TaskType, date: string) => void;
  onDelete: (task: Task) => void;
  onService: (key: string) => void;
}) {
  const [day, setDay] = useState<'today' | 'tomorrow' | 'all'>('today');
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskType>('main');
  const target = useMemo(() => {
    const date = new Date();
    if (day === 'tomorrow') date.setDate(date.getDate() + 1);
    return date;
  }, [day]);
  const tasks = day === 'all' ? dashboard.tasks : dashboard.tasks.filter(task => sameDay(task.date, target));
  const totalLessons = dashboard.courses.reduce((sum, course) => sum + course.lessons.length, 0);
  const progress = totalLessons ? Math.round(dashboard.stats.completedLessons / totalLessons * 100) : 0;

  const submit = () => {
    if (title.trim().length < 2) return;
    const date = new Date(target.getFullYear(), target.getMonth(), target.getDate()).toISOString();
    onAdd(title.trim(), type, date);
    setTitle('');
    setModal(false);
  };

  return <>
    <header className="home-topbar">
      <span className="academy-mark"><Sparkle size={13} weight="fill" />Academy</span>
      <span className="date-pill"><ArrowRight size={15} />{currentDateLabel()}</span>
    </header>
    <h1 className="home-greeting">Привет,{' '}<em>{dashboard.user.name}</em></h1>

    <section className="home-stats" aria-label="Прогресс пользователя">
      <article><strong className="stat-serif">{dashboard.user.streakDays}</strong><span>дней подряд</span></article>
      <article><strong>{dashboard.user.level}</strong><span>уровень {Math.floor(dashboard.user.xp / 500)}</span></article>
      <article><strong className="stat-serif">{progress}%</strong><span>прогресс</span></article>
    </section>

    <div className="service-grid">{services.map(({ key, label, icon: Icon }) =>
      <button className="service-card" key={key} onClick={() => onService(key)}>
        <Icon className="service-icon" size={47} weight="fill" />
        <ArrowRight className="service-arrow" size={19} />
        <strong>{label}</strong>
      </button>
    )}</div>

    <section className="tasks-section">
      <SectionTitle action={<span className="method">— методика 1–3–5</span>}>Мои задачи</SectionTitle>
      <p className="section-copy">Одна главная задача дня, до трёх средних и до пяти маленьких. Больше — можно, это ориентир, а не запрет: XP идёт за первые 1–3–5 закрытых за день.</p>
      <Segmented value={day} onChange={setDay} options={[{ value: 'today', label: 'Сегодня' }, { value: 'tomorrow', label: 'Завтра' }, { value: 'all', label: 'Все' }]} />
      <div className="task-groups">{groups.map(group => {
        const groupTasks = tasks.filter(task => task.type === group.type);
        const done = groupTasks.filter(task => task.isCompleted).length;
        return <div className="task-group" key={group.type}>
          <div className="task-group-title"><div><strong>{group.label}</strong><span>{group.xp} XP</span></div><b>{Math.min(done, group.limit)}/{group.limit}</b></div>
          {groupTasks.length ? groupTasks.map(task => <div className={`task-row ${task.isCompleted ? 'done' : ''}`} key={task.id}>
            <button className="task-toggle" onClick={() => onToggle(task)}>
              <span className="checkbox">{task.isCompleted ? <Check size={14} weight="bold" /> : null}</span>
              <span>{task.title}</span>
              <em>{task.xpReward > 0 ? `+${task.xpReward}` : 'без XP'}</em>
            </button>
            <button className="task-delete" aria-label={`Удалить задачу ${task.title}`} onClick={() => onDelete(task)}><Trash size={16} /></button>
          </div>) : <p className="empty">{group.empty}</p>}
        </div>;
      })}</div>
      <button className="primary add-task-button" onClick={() => setModal(true)}><Plus size={20} weight="bold" />Добавить задачу</button>
    </section>

    {modal ? <div className="modal-backdrop" onMouseDown={event => event.currentTarget === event.target && setModal(false)}><div className="modal" role="dialog" aria-modal="true">
      <div><span className="eyebrow">Новая задача</span><h2>Что нужно сделать?</h2></div>
      <input autoFocus value={title} onChange={event => setTitle(event.target.value)} onKeyDown={event => event.key === 'Enter' && submit()} placeholder="Например, написать оффер" />
      <Segmented value={type} onChange={setType} options={[{ value: 'main', label: 'Главная' }, { value: 'medium', label: 'Средняя' }, { value: 'small', label: 'Маленькая' }]} />
      <button className="primary" onClick={submit}>Добавить</button>
      <button className="ghost" onClick={() => setModal(false)}>Отмена</button>
    </div></div> : null}
  </>;
}
