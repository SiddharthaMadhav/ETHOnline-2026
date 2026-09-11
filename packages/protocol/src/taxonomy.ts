/**
 * Canonical Hark topic taxonomy (CLAUDE.md section 8).
 * Represented as code for v0.1 - no on-chain topic registry.
 */
export type TopicDefinition = {
  id: string;
  label: string;
  parentId?: string;
};

const rawTopics: TopicDefinition[] = [
  { id: "electronics", label: "Electronics" },
  { id: "electronics.computer", label: "Computers", parentId: "electronics" },
  { id: "electronics.computer.laptop", label: "Laptops", parentId: "electronics.computer" },
  { id: "electronics.computer.desktop", label: "Desktops", parentId: "electronics.computer" },
  { id: "electronics.phone", label: "Phones", parentId: "electronics" },
  { id: "electronics.tablet", label: "Tablets", parentId: "electronics" },

  { id: "travel", label: "Travel" },
  { id: "travel.flight", label: "Flights", parentId: "travel" },
  { id: "travel.hotel", label: "Hotels", parentId: "travel" },
  { id: "travel.package", label: "Travel Packages", parentId: "travel" },

  { id: "automotive", label: "Automotive" },
  { id: "automotive.car", label: "Cars", parentId: "automotive" },
  { id: "automotive.motorcycle", label: "Motorcycles", parentId: "automotive" },

  { id: "finance", label: "Finance" },
  { id: "finance.insurance", label: "Insurance", parentId: "finance" },
  { id: "finance.credit-card", label: "Credit Cards", parentId: "finance" },
  { id: "finance.loan", label: "Loans", parentId: "finance" },

  { id: "sports", label: "Sports" },
  { id: "sports.running", label: "Running", parentId: "sports" },
  { id: "sports.cycling", label: "Cycling", parentId: "sports" },

  { id: "fitness", label: "Fitness" },
  { id: "fitness.gym", label: "Gym", parentId: "fitness" },

  { id: "home", label: "Home" },
  { id: "home.furniture", label: "Furniture", parentId: "home" },
  { id: "home.renovation", label: "Renovation", parentId: "home" },

  { id: "education", label: "Education" },
  { id: "education.course", label: "Courses", parentId: "education" },
  {
    id: "education.student-technology",
    label: "Student Technology",
    parentId: "education",
  },
];

export const TAXONOMY: ReadonlyMap<string, TopicDefinition> = new Map(
  rawTopics.map((topic) => [topic.id, topic]),
);

export function getTopic(id: string): TopicDefinition | undefined {
  return TAXONOMY.get(id);
}

export function isValidTopicId(id: string): boolean {
  return TAXONOMY.has(id);
}

export function listTopics(): TopicDefinition[] {
  return [...TAXONOMY.values()];
}

/** Full ancestor chain for a topic, from itself up to the root, e.g. ["a.b.c", "a.b", "a"]. */
function ancestorChain(id: string): string[] {
  const chain: string[] = [];
  let current = TAXONOMY.get(id);
  while (current) {
    chain.push(current.id);
    current = current.parentId ? TAXONOMY.get(current.parentId) : undefined;
  }
  return chain;
}

/** True if `candidate` is the same topic as `target`, or a descendant of it. */
export function isSameOrDescendant(candidate: string, target: string): boolean {
  return ancestorChain(candidate).includes(target);
}

/**
 * Distance between two topics in the taxonomy tree, measured via their nearest
 * common ancestor. Returns `Infinity` if the topics share no ancestor (including
 * when either topic id is unknown).
 */
export function topicDistance(a: string, b: string): number {
  if (a === b) return 0;

  const chainA = ancestorChain(a);
  const chainB = ancestorChain(b);
  if (chainA.length === 0 || chainB.length === 0) return Infinity;

  const depthB = new Map(chainB.map((id, index) => [id, index]));

  for (let indexA = 0; indexA < chainA.length; indexA += 1) {
    const ancestor = chainA[indexA] as string;
    const indexB = depthB.get(ancestor);
    if (indexB !== undefined) {
      return indexA + indexB;
    }
  }

  return Infinity;
}
