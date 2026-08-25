type Matchable = {
  id: string;
  location: string | null;
  occupation: string | null;
  giveTags: string[];
  seekTags: string[];
};

const normalize = (value: string) => value.trim().toLocaleLowerCase('ru-RU');

export function parseTags(value: string, limit = 8) {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const rawTag of value.split(/[,;\n]+/)) {
    const tag = rawTag.trim().replace(/\s+/g, ' ');
    const key = normalize(tag);
    if (tag.length < 2 || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length === limit) break;
  }
  return tags;
}

export function matchScore(user: Matchable, candidate: Matchable) {
  const userGives = new Set(user.giveTags.map(normalize));
  const userSeeks = new Set(user.seekTags.map(normalize));
  const candidateGives = new Set(candidate.giveTags.map(normalize));
  const candidateSeeks = new Set(candidate.seekTags.map(normalize));
  let score = 0;
  for (const tag of userSeeks) if (candidateGives.has(tag)) score += 4;
  for (const tag of candidateSeeks) if (userGives.has(tag)) score += 3;
  for (const tag of userGives) if (candidateGives.has(tag)) score += 1;
  if (user.location && candidate.location && normalize(user.location) === normalize(candidate.location)) score += 2;
  if (user.occupation && candidate.occupation && normalize(user.occupation) === normalize(candidate.occupation)) score += 1;
  return score;
}

export function chooseCandidate<T extends Matchable>(user: Matchable, candidates: T[]) {
  return [...candidates].sort((left, right) => matchScore(user, right) - matchScore(user, left) || left.id.localeCompare(right.id))[0] ?? null;
}

export function pairKey(firstUserId: string, secondUserId: string) {
  return [firstUserId, secondUserId].sort().join(':');
}
