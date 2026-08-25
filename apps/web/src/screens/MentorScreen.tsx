import { useState } from 'react';
import { ArrowUp, Bot, Sparkles } from 'lucide-react';
import { ScreenHeader } from '../components';

const prompts = ['Помоги расставить задачи', 'Где искать первых клиентов?', 'Разбери мой оффер', 'Сколько брать за работу?'];

function questionWord(value: number) {
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return 'вопросов';
  const last = value % 10;
  if (last === 1) return 'вопрос';
  if (last >= 2 && last <= 4) return 'вопроса';
  return 'вопросов';
}

export function MentorScreen({ remaining, onAsk }: { remaining: number; onAsk: (question: string) => Promise<{ answer: string; remaining: number }> }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const submit = async (value = question) => {
    const clean = value.trim(); if (!clean || loading || remaining <= 0) return;
    setMessages(items => [...items, { role: 'user', text: clean }]); setQuestion(''); setLoading(true);
    try { const result = await onAsk(clean); setMessages(items => [...items, { role: 'assistant', text: result.answer }]); }
    catch (error) { setMessages(items => [...items, { role: 'assistant', text: error instanceof Error ? error.message : 'Не удалось получить ответ' }]); }
    finally { setLoading(false); }
  };
  return <><ScreenHeader section="ПОМОЩНИК" title="Твой" italic="наставник" /><p className="lead">Спроси про клиентов, цену или оффер — ответ будет учитывать твою цель и профиль.</p>
    <div className="prompt-list">{prompts.map(prompt => <button key={prompt} onClick={() => submit(prompt)}>{prompt}</button>)}</div>
    <div className="chat-window">{messages.length === 0 ? <div className="chat-empty"><span><Sparkles size={20} /></span><strong>Начни с вопроса</strong><p>Дам конкретный следующий шаг без воды.</p></div> : messages.map((message, index) => <div key={index} className={`message ${message.role}`} >{message.role === 'assistant' ? <Bot size={16} /> : null}<p>{message.text}</p></div>)}{loading ? <div className="typing"><i /><i /><i /></div> : null}</div>
    <div className="composer"><textarea value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder="Напиши вопрос…" /><button onClick={() => submit()} aria-label="Отправить"><ArrowUp size={20} /></button></div>
    <p className="limit">Осталось {remaining} {questionWord(remaining)} на сегодня</p>
  </>;
}
