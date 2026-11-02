import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Phrase } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import type {
  AddExampleDto,
  CreatePhraseDto,
  ListPhrasesQuery,
  ReviewPhraseDto,
  SpokenAttemptDto,
  UpdatePhraseDto,
} from '../dto/phrase.dto.js';
import { DailyGateService } from './daily-gate.service.js';
import {
  containsPhrase,
  isSamePhrase,
  isSingleWord,
  matchPhrase,
  normalizePhrase,
  tokenize,
} from './phrase-matcher.js';
import {
  addDays,
  allowedGrades,
  applyReview,
  applySpeakPassed,
  computeStreak,
  stageAfterWrite,
} from './phrase-schedule.js';

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

/** The same sentence ignoring case, punctuation and spacing. */
const sentenceKey = (text: string) => tokenize(text).join(' ');

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002';

const DUPLICATE_MESSAGE = 'Cụm từ này đã có trong sổ của bạn.';

@Injectable()
export class PhraseService {
  constructor(
    private prisma: PrismaService,
    private dailyGate: DailyGateService,
  ) {}

  private view(phrase: Phrase) {
    return { ...phrase, nextReviewAt: dayKey(phrase.nextReviewAt) };
  }

  private async findOwned(userId: string, id: string) {
    const phrase = await this.prisma.phrase.findFirst({
      where: { id, userId },
    });
    if (!phrase) throw new NotFoundException('Không tìm thấy cụm từ này.');
    return phrase;
  }

  /** Marks today as a day with activity in the notebook (for the streak). */
  private markActive(userId: string, today: Date) {
    return this.prisma.phraseActivityDay.upsert({
      where: { userId_day: { userId, day: today } },
      create: { userId, day: today },
      update: {},
    });
  }

  private requirePracticable(phrase: Phrase) {
    if (phrase.stage === 'WRITE') {
      throw new BadRequestException(
        'Hãy đặt một câu với cụm từ này trước (bước 2).',
      );
    }
  }

  /* ------------------------------------------------------------------------ */

  async list(userId: string, query: ListPhrasesQuery) {
    const today = this.dailyGate.today();
    const phrases = await this.prisma.phrase.findMany({
      where: {
        userId,
        // A phrase without a sentence yet is not "due"; it has its own group.
        ...(query.due === 'true'
          ? { stage: { not: 'WRITE' }, nextReviewAt: { lte: today } }
          : {}),
        ...(query.stage ? { stage: query.stage } : {}),
      },
      orderBy: [{ nextReviewAt: 'asc' }, { createdAt: 'asc' }],
    });
    return phrases.map((phrase) => this.view(phrase));
  }

  async summary(userId: string) {
    const today = this.dailyGate.today();
    const [byStage, due, activity] = await Promise.all([
      this.prisma.phrase.groupBy({
        by: ['stage'],
        where: { userId },
        _count: { _all: true },
      }),
      this.prisma.phrase.count({
        where: {
          userId,
          stage: { not: 'WRITE' },
          nextReviewAt: { lte: today },
        },
      }),
      this.prisma.phraseActivityDay.findMany({
        where: { userId, day: { lte: today } },
        orderBy: { day: 'desc' },
        take: 400,
      }),
    ]);
    const count = (stage: string) =>
      byStage.find((row) => row.stage === stage)?._count._all ?? 0;
    const days = activity.map((row) => row.day);
    return {
      total: byStage.reduce((sum, row) => sum + row._count._all, 0),
      mastered: count('MASTERED'),
      unwritten: count('WRITE'),
      due,
      streak: computeStreak(days, today),
      practicedToday: days.some((day) => day.getTime() === today.getTime()),
    };
  }

  async get(userId: string, id: string) {
    const phrase = await this.prisma.phrase.findFirst({
      where: { id, userId },
      include: {
        examples: { orderBy: { createdAt: 'asc' } },
        attempts: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!phrase) throw new NotFoundException('Không tìm thấy cụm từ này.');
    const { examples, attempts, ...rest } = phrase;
    return { ...this.view(rest), examples, spokenAttempts: attempts };
  }

  async create(userId: string, dto: CreatePhraseDto) {
    const phrase = dto.phrase.trim().replace(/\s+/g, ' ');
    if (tokenize(phrase).length === 0) {
      throw new BadRequestException('Cụm từ cần có ít nhất một từ.');
    }

    let sampleSentence = dto.sampleSentence?.trim() || null;
    if (dto.wordId !== undefined) {
      const word = await this.prisma.vocabularyWord.findUnique({
        where: { id: dto.wordId },
      });
      if (!word) {
        throw new BadRequestException('Không tìm thấy từ trong bài học.');
      }
      sampleSentence ??= word.example;
    }

    try {
      const created = await this.prisma.phrase.create({
        data: {
          userId,
          wordId: dto.wordId,
          phrase,
          phraseNormalized: normalizePhrase(phrase),
          meaning: dto.meaning.trim(),
          sampleSentence,
          nextReviewAt: this.dailyGate.today(),
        },
      });
      return { ...this.view(created), isSingleWord: isSingleWord(phrase) };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(DUPLICATE_MESSAGE);
      }
      throw error;
    }
  }

  async update(userId: string, id: string, dto: UpdatePhraseDto) {
    await this.findOwned(userId, id);
    const phrase = dto.phrase?.trim().replace(/\s+/g, ' ');
    if (phrase !== undefined && tokenize(phrase).length === 0) {
      throw new BadRequestException('Cụm từ cần có ít nhất một từ.');
    }
    try {
      const updated = await this.prisma.phrase.update({
        where: { id },
        data: {
          ...(phrase !== undefined
            ? { phrase, phraseNormalized: normalizePhrase(phrase) }
            : {}),
          ...(dto.meaning !== undefined ? { meaning: dto.meaning.trim() } : {}),
          ...(dto.sampleSentence !== undefined
            ? { sampleSentence: dto.sampleSentence.trim() || null }
            : {}),
        },
      });
      return this.view(updated);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(DUPLICATE_MESSAGE);
      }
      throw error;
    }
  }

  async remove(userId: string, id: string) {
    await this.findOwned(userId, id);
    await this.prisma.phrase.delete({ where: { id } });
    return { deleted: true };
  }

  /* ------------------------------------------------------------------------ */
  /* Step 2: write a sentence                                                 */
  /* ------------------------------------------------------------------------ */

  async addExample(userId: string, id: string, dto: AddExampleDto) {
    const phrase = await this.findOwned(userId, id);
    const text = dto.text.trim();
    if (!containsPhrase(phrase.phrase, text)) {
      throw new BadRequestException(
        `Câu chưa chứa cụm từ "${phrase.phrase}". Hãy dùng cụm này trong câu (có thể chia động từ).`,
      );
    }

    const today = this.dailyGate.today();
    const isFirst = phrase.stage === 'WRITE';
    const [example, updated] = await this.prisma.$transaction([
      this.prisma.phraseExample.create({
        data: { phraseId: id, text, step: 'WRITE' },
      }),
      this.prisma.phrase.update({
        where: { id },
        // The first sentence starts the schedule: first recall tomorrow.
        data: isFirst
          ? {
              stage: stageAfterWrite(phrase.stage),
              intervalDays: 1,
              nextReviewAt: addDays(today, 1),
            }
          : {},
      }),
      this.markActive(userId, today),
    ]);
    return { example, phrase: this.view(updated) };
  }

  /* ------------------------------------------------------------------------ */
  /* Step 3: recall                                                           */
  /* ------------------------------------------------------------------------ */

  async review(userId: string, id: string, dto: ReviewPhraseDto) {
    const phrase = await this.findOwned(userId, id);
    this.requirePracticable(phrase);

    // The server checks the answer itself, so a wrong answer cannot be graded "Easy".
    const isAnswerCorrect = isSamePhrase(phrase.phrase, dto.answer);
    const allowed = allowedGrades({ isAnswerCorrect, usedHint: dto.usedHint });
    if (!allowed.includes(dto.grade)) {
      throw new BadRequestException(
        isAnswerCorrect
          ? 'Bạn đã dùng gợi ý, không thể chọn "Dễ".'
          : 'Bạn chưa nhớ đúng cụm từ, chỉ có thể chọn "Quên".',
      );
    }

    const sentence =
      dto.grade === 'FORGOT' ? undefined : await this.newSentence(phrase, dto);

    const today = this.dailyGate.today();
    const next = applyReview(phrase, dto.grade, today);
    const [updated] = await this.prisma.$transaction([
      this.prisma.phrase.update({
        where: { id },
        data: {
          stage: next.stage,
          intervalDays: next.intervalDays,
          easyStreak: next.easyStreak,
          speakPassed: next.speakPassed,
          nextReviewAt: next.nextReviewAt,
        },
      }),
      this.markActive(userId, today),
      // One row per accepted recall, so the learning calendar can show it.
      this.prisma.phraseReview.create({
        data: { phraseId: id, grade: dto.grade, usedHint: dto.usedHint },
      }),
      ...(sentence
        ? [
            this.prisma.phraseExample.create({
              data: {
                phraseId: id,
                text: sentence,
                step: 'RECALL',
                usedHint: dto.usedHint,
              },
            }),
          ]
        : []),
    ]);
    return { isAnswerCorrect, phrase: this.view(updated) };
  }

  /** The sentence written at step 3: must use the phrase and must be new. */
  private async newSentence(phrase: Phrase, dto: ReviewPhraseDto) {
    const sentence = dto.sentence?.trim();
    if (!sentence) {
      throw new BadRequestException(
        'Hãy đặt một câu mới với cụm từ này (bước 3).',
      );
    }
    if (!containsPhrase(phrase.phrase, sentence)) {
      throw new BadRequestException(`Câu chưa chứa cụm từ "${phrase.phrase}".`);
    }
    const previous = await this.prisma.phraseExample.findMany({
      where: { phraseId: phrase.id },
      select: { text: true },
    });
    const seen = new Set(previous.map((row) => sentenceKey(row.text)));
    if (phrase.sampleSentence) seen.add(sentenceKey(phrase.sampleSentence));
    if (seen.has(sentenceKey(sentence))) {
      throw new BadRequestException(
        'Câu này trùng với câu đã viết trước đó. Hãy đặt một câu mới.',
      );
    }
    return sentence;
  }

  /* ------------------------------------------------------------------------ */
  /* Step 4: speak                                                            */
  /* ------------------------------------------------------------------------ */

  async recordSpoken(userId: string, id: string, dto: SpokenAttemptDto) {
    const phrase = await this.findOwned(userId, id);
    this.requirePracticable(phrase);

    const transcript = dto.transcript.trim();
    // Decided here, never taken from the client.
    const match = matchPhrase(phrase.phrase, transcript);
    const today = this.dailyGate.today();
    const passesNow = match.matched && !phrase.speakPassed;

    const [, updated] = await this.prisma.$transaction([
      this.prisma.phraseSpokenAttempt.create({
        data: { phraseId: id, transcript, containsPhrase: match.matched },
      }),
      this.prisma.phrase.update({
        where: { id },
        data: passesNow
          ? { speakPassed: true, stage: applySpeakPassed(phrase).stage }
          : {},
      }),
      this.markActive(userId, today),
    ]);
    return {
      containsPhrase: match.matched,
      /** Which words of the transcript (split like `tokenize`) matched, for highlighting. */
      matchedIndexes: match.indexes,
      phrase: this.view(updated),
    };
  }
}
