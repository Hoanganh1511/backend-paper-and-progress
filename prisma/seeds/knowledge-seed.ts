// Seeds the Knowledge Library (domains, categories, topics) and the Backend Step Tutor learning path.
//   node --experimental-strip-types prisma/seeds/knowledge-seed.ts
// Safe to run again: everything is matched by slug and updated in place, so nobody's progress is lost.
// The data files were made from the app's earlier static data (features/tech, features/learning, features/tutor).
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const read = (name: string) =>
  JSON.parse(readFileSync(new URL(`./${name}`, import.meta.url), 'utf8'));

interface TopicSeed {
  slug: string;
  name: string;
  description?: string | null;
  icon?: string;
  groupLabel?: string | null;
}
interface CategorySeed {
  slug: string;
  name: string;
  description?: string | null;
  icon?: string;
  order?: number;
  topics: TopicSeed[];
}
interface DomainSeed {
  slug: string;
  name: string;
  description?: string | null;
  icon?: string;
  categories: CategorySeed[];
}

async function seedKnowledge() {
  const { domains } = read('knowledge-data.json') as { domains: DomainSeed[] };
  let topics = 0;
  for (const [domainIndex, domain] of domains.entries()) {
    const parent = await prisma.knowledgeCategory.upsert({
      where: { slug: domain.slug },
      create: {
        slug: domain.slug,
        name: domain.name,
        description: domain.description ?? null,
        icon: domain.icon ?? 'book',
        order: domainIndex,
      },
      update: {
        name: domain.name,
        description: domain.description ?? null,
        icon: domain.icon ?? 'book',
        order: domainIndex,
      },
    });
    for (const [categoryIndex, category] of domain.categories.entries()) {
      const data = {
        name: category.name,
        description: category.description ?? null,
        icon: category.icon ?? 'book',
        order: category.order ?? categoryIndex,
        parentId: parent.id,
      };
      const saved = await prisma.knowledgeCategory.upsert({
        where: { slug: category.slug },
        create: { slug: category.slug, ...data },
        update: data,
      });
      for (const [topicIndex, topic] of category.topics.entries()) {
        const fields = {
          name: topic.name,
          description: topic.description ?? null,
          icon: topic.icon ?? 'book',
          groupLabel: topic.groupLabel ?? null,
          order: topicIndex,
          categoryId: saved.id,
        };
        await prisma.topic.upsert({
          where: { slug: topic.slug },
          create: { slug: topic.slug, ...fields },
          update: fields,
        });
        topics += 1;
      }
    }
  }
  console.log(`knowledge: ${domains.length} domains, ${topics} topics`);
}

interface StepSeed {
  slug: string;
  order: number;
  title: string;
  durationMinutes: number | null;
  heading: string;
  lead: string;
  content: unknown;
}
interface PathSeed {
  slug: string;
  title: string;
  description: string;
  topics: string[];
  phases: { order: number; title: string; steps: StepSeed[] }[];
}

async function seedPath(file: string, order: number) {
  const seed = read(file) as PathSeed;
  const path = await prisma.learningPath.upsert({
    where: { slug: seed.slug },
    create: {
      slug: seed.slug,
      title: seed.title,
      description: seed.description,
      order,
    },
    update: { title: seed.title, description: seed.description, order },
  });

  const topics = await prisma.topic.findMany({
    where: { slug: { in: seed.topics } },
    select: { id: true, slug: true },
  });
  const missing = seed.topics.filter((slug) => !topics.some((t) => t.slug === slug));
  if (missing.length > 0) console.warn(`  topics not found: ${missing.join(', ')}`);
  for (const topic of topics) {
    await prisma.learningPathTopic.upsert({
      where: { pathId_topicId: { pathId: path.id, topicId: topic.id } },
      create: { pathId: path.id, topicId: topic.id },
      update: {},
    });
  }

  let steps = 0;
  for (const phase of seed.phases) {
    const savedPhase = await prisma.learningPhase.upsert({
      where: { pathId_order: { pathId: path.id, order: phase.order } },
      create: { pathId: path.id, order: phase.order, title: phase.title },
      update: { title: phase.title },
    });
    for (const step of phase.steps) {
      const data = {
        phaseId: savedPhase.id,
        order: step.order,
        title: step.title,
        durationMinutes: step.durationMinutes,
        heading: step.heading,
        lead: step.lead,
        content: step.content as object,
      };
      await prisma.learningStep.upsert({
        where: { pathId_slug: { pathId: path.id, slug: step.slug } },
        create: { pathId: path.id, slug: step.slug, ...data },
        update: data,
      });
      steps += 1;
    }
  }
  console.log(`path ${seed.slug}: ${seed.phases.length} phases, ${steps} steps`);
}

async function main() {
  await seedKnowledge();
  await seedPath('learning-path-backend-step-tutor.json', 0);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
