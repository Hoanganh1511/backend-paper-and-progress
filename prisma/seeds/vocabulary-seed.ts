// Seeds the Daily English Gate: the vocabulary units and the 30 daily lessons.
//   node --experimental-strip-types prisma/seeds/vocabulary-seed.ts          # skips if units exist
//   node --experimental-strip-types prisma/seeds/vocabulary-seed.ts --reset  # wipes the gate data, then seeds
// DAILY_GATE_START_DATE (YYYY-MM-DD, default 2026-11-01) is day 1.
import { PrismaClient } from '@prisma/client';
import { SECTIONS, UNITS } from './vocabulary-data.ts';
import { LESSON_PLAN } from './lesson-plan.ts';

const prisma = new PrismaClient();
const START_DATE = process.env.DAILY_GATE_START_DATE ?? '2026-11-01';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Day `dayNumber` as a UTC midnight, which a `@db.Date` column stores as that calendar day. */
function lessonDate(dayNumber: number) {
  return new Date(
    Date.parse(`${START_DATE}T00:00:00.000Z`) + (dayNumber - 1) * DAY_MS,
  );
}

async function reset() {
  await prisma.wordReview.deleteMany();
  await prisma.userDailyProgress.deleteMany();
  await prisma.dailyLesson.deleteMany();
  await prisma.vocabularyWord.deleteMany();
  await prisma.vocabularyUnit.deleteMany();
}

async function main() {
  if (process.argv.includes('--reset')) {
    await reset();
    console.log('Daily Gate data cleared.');
  } else if ((await prisma.vocabularyUnit.count()) > 0) {
    console.log('Vocabulary already seeded. Use --reset to seed again.');
    return;
  }

  const unitIds = new Map<number, number>();
  let wordCount = 0;
  for (const unit of UNITS) {
    const row = await prisma.vocabularyUnit.create({
      data: { unitNumber: unit.unitNumber, topic: unit.topic },
    });
    unitIds.set(unit.unitNumber, row.id);

    for (const section of SECTIONS) {
      const entries = unit.sections[section];
      if (entries.length === 0) continue;
      await prisma.vocabularyWord.createMany({
        data: entries.map((entry) => ({
          unitId: row.id,
          section,
          word: entry.word,
          meaning: entry.meaning,
          example: entry.example,
          contrast: entry.contrast ?? null,
          forms: entry.forms ?? null,
          pattern: entry.pattern ?? null,
        })),
      });
      wordCount += entries.length;
    }
  }

  for (const lesson of LESSON_PLAN) {
    await prisma.dailyLesson.create({
      data: {
        dayNumber: lesson.dayNumber,
        date: lessonDate(lesson.dayNumber),
        type: lesson.type,
        unitIds: lesson.unitNumbers.map((n) => {
          const id = unitIds.get(n);
          if (id === undefined)
            throw new Error(`Unit ${n} is not in the vocabulary`);
          return id;
        }),
      },
    });
  }

  const units = UNITS.filter((u) =>
    SECTIONS.some((s) => u.sections[s].length > 0),
  ).length;
  console.log(
    `Seeded ${UNITS.length} units (${units} with words), ${wordCount} words and ${LESSON_PLAN.length} lessons from ${START_DATE}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
