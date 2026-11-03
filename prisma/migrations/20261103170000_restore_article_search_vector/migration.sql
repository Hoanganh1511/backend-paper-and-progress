-- Restores the full-text search column of "Article".
--
-- `prisma migrate dev` saw a column Prisma cannot model (a generated tsvector) and
-- generated, then applied, 20261103014003_add_word_sentences, which dropped it. Article
-- and site search both read this column. It is generated from title, excerpt and
-- contentText, so re-adding it recomputes it from the existing articles; nothing is lost.
-- Same definition as 20261101094353_add_articles.
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("excerpt", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("contentText", '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS "Article_searchVector_idx" ON "Article" USING GIN ("searchVector");
