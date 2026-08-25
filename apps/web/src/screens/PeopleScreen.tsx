import { useEffect, useState } from 'react';
import { ArrowUpRight, EyeOff, MessageCircle, Pencil, Trophy } from 'lucide-react';
import { ScreenHeader, SectionTitle, Segmented } from '../components';
import type { Leaderboard, Member, User } from '../types';

export function PeopleScreen({ user, members, leaderboard, onLoadLeaderboard, onVisibility, onProfile, onConnect }: {
  user: User; members: Member[]; leaderboard: Leaderboard; onLoadLeaderboard: (period: 'month' | 'all') => void;
  onVisibility: (value: boolean) => void; onProfile: (input: { giveTags: string[]; seekTags: string[] }) => void; onConnect: (member: Member) => void;
}) {
  const [tab, setTab] = useState<'members' | 'rating'>('members');
  const [period, setPeriod] = useState<'month' | 'all'>('month');
  const [editing, setEditing] = useState(false);
  const [give, setGive] = useState(user.giveTags.join(', '));
  const [seek, setSeek] = useState(user.seekTags.join(', '));
  useEffect(() => { if (tab === 'rating') onLoadLeaderboard(period); }, [tab, period, onLoadLeaderboard]);
  const save = () => { onProfile({ giveTags: give.split(',').map(value => value.trim()).filter(Boolean), seekTags: seek.split(',').map(value => value.trim()).filter(Boolean) }); setEditing(false); };
  return <><ScreenHeader section="НЕТВОРКИНГ" title={tab === 'members' ? 'Твои' : 'Лидеры'} italic={tab === 'members' ? 'знакомства' : 'академии'} />
    <Segmented value={tab} onChange={setTab} options={[{ value: 'members', label: 'Участники' }, { value: 'rating', label: 'Рейтинг' }]} />
    {tab === 'members' ? <>
      <article className="match-profile"><div className="status"><i />{user.isDiscoverable ? 'Ты участвуешь в подборе' : 'Анкета скрыта'}</div><p><b>Даю:</b> {user.giveTags.join(', ') || 'не заполнено'}</p><p><b>Ищу:</b> {user.seekTags.join(', ') || 'не заполнено'}</p><div className="inline-actions"><button onClick={() => onVisibility(!user.isDiscoverable)}><EyeOff size={16} />{user.isDiscoverable ? 'Скрыть' : 'Показать'}</button><button onClick={() => setEditing(true)}><Pencil size={16} />Изменить</button></div></article>
      <SectionTitle>Знакомства недели</SectionTitle><div className="weekly-note"><strong>Новые мэтчи — по понедельникам</strong><p>Чем точнее «даю / ищу», тем полезнее люди рядом.</p></div>
      <SectionTitle>Все участники</SectionTitle><div className="member-list">{members.length ? members.map(member => <article className="member-card" key={member.id}><div className="member-main"><span className="member-avatar">{member.name?.[0] ?? '?'}</span><div><strong>{member.name}</strong><small>{member.location} · {member.occupation}</small></div><ArrowUpRight size={17} /></div><p>{member.goal}</p><div className="tags">{member.giveTags.map(tag => <span key={tag}>{tag}</span>)}</div><button className="primary" onClick={() => onConnect(member)}><MessageCircle size={17} />Хочу пообщаться</button></article>) : <p className="empty-state">Новые участники появятся после модерации анкет.</p>}</div>
    </> : <>
      <Segmented value={period} onChange={setPeriod} options={[{ value: 'month', label: 'За месяц' }, { value: 'all', label: 'За всё время' }]} /><p className="limit">Очки обновляются по подтверждённым действиям</p>
      <div className="leaderboard">{leaderboard.leaders.map((leader, index) => <div className={`leader ${index < 3 ? `top top-${index + 1}` : ''}`} key={leader.id ?? index}><span>{index < 3 ? <Trophy size={17} /> : `${index + 1}.`}</span><strong>{leader.name ?? leader.username ?? 'Участник'}</strong><b>{leader.score} <small>XP</small></b></div>)}</div>
      <SectionTitle>Твоя позиция</SectionTitle><div className="leader me"><span>{leaderboard.me.position}.</span><strong>{leaderboard.me.name ?? user.name}</strong><b>{leaderboard.me.score} <small>XP</small></b></div>
    </>}
    {editing ? <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true"><span className="eyebrow">Анкета нетворкинга</span><h2>Даю / Ищу</h2><label>Чем можешь помочь<input value={give} onChange={event => setGive(event.target.value)} placeholder="AI, маркетинг, дизайн" /></label><label>Что ищешь<input value={seek} onChange={event => setSeek(event.target.value)} placeholder="Клиенты, партнёрство" /></label><button className="primary" onClick={save}>Сохранить</button><button className="ghost" onClick={() => setEditing(false)}>Отмена</button></div></div> : null}
  </>;
}

