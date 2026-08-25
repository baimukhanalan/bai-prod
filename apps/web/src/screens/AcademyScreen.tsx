import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Diamond, FileText, GraduationCap, Headphones, Lock, Play } from 'lucide-react';
import { ScreenHeader, SectionTitle } from '../components';
import type { Course, Lesson } from '../types';

const kindIcon = { video: Play, audio: Headphones, text: FileText };

export function AcademyScreen({ courses, onComplete }: { courses: Course[]; onComplete: (lesson: Lesson, completed: boolean) => Promise<boolean> }) {
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const freeCourse = courses.find(course => course.access === 'free') ?? courses[0];
  const completed = freeCourse?.lessons.filter(lesson => lesson.isCompleted).length ?? 0;
  const nextLesson = freeCourse?.lessons.find(lesson => !lesson.isCompleted) ?? freeCourse?.lessons.at(-1);
  const progress = freeCourse?.lessons.length ? Math.round(completed / freeCourse.lessons.length * 100) : 0;
  const lessonIndex = useMemo(() => freeCourse?.lessons.findIndex(lesson => lesson.id === activeLesson?.id) ?? -1, [activeLesson, freeCourse]);

  if (activeLesson) {
    const Icon = kindIcon[activeLesson.kind];
    const nextLessonLocked = lessonIndex >= 0
      && lessonIndex < (freeCourse?.lessons.length ?? 0) - 1
      && !activeLesson.isCompleted;
    return <><button className="back-link" onClick={() => setActiveLesson(null)}><ArrowLeft size={17} /> К программе</button>
      <ScreenHeader section="УРОК" title={activeLesson.title} />
      <article className="lesson-player"><div className="lesson-media"><Icon size={34} /><span>{activeLesson.kind === 'video' ? 'Видео' : activeLesson.kind === 'audio' ? 'Аудио' : 'Материал'} · {activeLesson.durationMinutes} мин</span></div><p>{activeLesson.body ?? activeLesson.description}</p>{activeLesson.contentUrl ? <a className="primary" href={activeLesson.contentUrl} target="_blank" rel="noreferrer">Открыть материал <ArrowRight size={17} /></a> : null}<button className={activeLesson.isCompleted ? 'ghost' : 'primary'} onClick={async () => { const completed = !activeLesson.isCompleted; if (await onComplete(activeLesson, completed)) setActiveLesson(current => current ? { ...current, isCompleted: completed } : current); }}>{activeLesson.isCompleted ? 'Отметить непройденным' : `Завершить урок · +${activeLesson.xpReward} XP`}</button></article>
      <div className="lesson-nav"><button disabled={lessonIndex <= 0} onClick={() => setActiveLesson(freeCourse!.lessons[lessonIndex - 1]!)}>Назад</button><button disabled={!freeCourse || lessonIndex >= freeCourse.lessons.length - 1 || nextLessonLocked} onClick={() => setActiveLesson(freeCourse!.lessons[lessonIndex + 1]!)}>Дальше</button></div>
    </>;
  }

  return <><ScreenHeader section="ОБУЧЕНИЕ" title="Твой" italic="путь" />
    <p className="lead">Начни с бесплатного курса — дальше ступени академии.</p>
    <SectionTitle>Бесплатный старт</SectionTitle>
    {freeCourse ? <article className="course-card"><div className="course-top"><span><GraduationCap size={22} /> {freeCourse.title}</span><b>{completed}/{freeCourse.lessons.length}</b></div><div className="lesson-progress">{freeCourse.lessons.map(lesson => <i key={lesson.id} className={lesson.isCompleted ? 'active' : ''} />)}</div><p>{freeCourse.description}</p><small>{freeCourse.lessons.length} урока · видео, аудио и текст · {progress}% пройдено</small>{nextLesson ? <button className="primary" onClick={() => setActiveLesson(nextLesson)}><Play size={17} fill="currentColor" /> {completed ? 'Продолжить' : 'Начать бесплатно'}</button> : null}</article> : <p className="empty-state">Курс скоро появится.</p>}
    {freeCourse?.lessons.length ? <div className="lesson-list">{freeCourse.lessons.map((lesson, index) => { const Icon = kindIcon[lesson.kind]; const locked = index > 0 && !freeCourse.lessons[index - 1]?.isCompleted; return <button key={lesson.id} disabled={locked} onClick={() => setActiveLesson(lesson)}><span className={lesson.isCompleted ? 'complete' : ''}>{lesson.isCompleted ? <Check size={16} /> : <Icon size={16} />}</span><span><strong>{index + 1}. {lesson.title}</strong><small>{lesson.durationMinutes} мин · {lesson.kind}</small></span>{locked ? <Lock size={16} /> : <ArrowRight size={16} />}</button>; })}</div> : null}
    <SectionTitle>Карта роста</SectionTitle>
    <div className="access-list">{courses.map(course => <button key={course.id} disabled={course.locked} onClick={() => { if (course.id === freeCourse?.id && nextLesson) setActiveLesson(nextLesson); }}><span className="access-icon">{course.access === 'free' ? <Check size={18} /> : course.access === 'vip' ? <Diamond size={18} /> : <GraduationCap size={18} />}</span><span><strong>{course.access === 'free' ? 'Бесплатный доступ' : course.title}</strong><small>{course.locked ? 'Закрыт' : 'Открыт'}</small></span>{course.locked ? <Lock size={17} /> : <ArrowRight size={18} />}</button>)}</div>
  </>;
}
