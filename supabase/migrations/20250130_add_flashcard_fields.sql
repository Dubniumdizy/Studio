-- Add missing fields to flashcard_decks table
ALTER TABLE flashcard_decks 
ADD COLUMN IF NOT EXISTS srs_good_interval INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS srs_easy_interval INTEGER DEFAULT 4,
ADD COLUMN IF NOT EXISTS archive_days INTEGER DEFAULT 90,
ADD COLUMN IF NOT EXISTS last_studied TIMESTAMPTZ;

-- Add missing fields to flashcards table
ALTER TABLE flashcards
ADD COLUMN IF NOT EXISTS front_image TEXT,
ADD COLUMN IF NOT EXISTS front_image_hint TEXT,
ADD COLUMN IF NOT EXISTS back_image TEXT,
ADD COLUMN IF NOT EXISTS back_image_hint TEXT;

-- Update difficulty check constraint to match app values
ALTER TABLE flashcards DROP CONSTRAINT IF EXISTS flashcards_difficulty_check;
ALTER TABLE flashcards ADD CONSTRAINT flashcards_difficulty_check 
CHECK (difficulty IS NULL OR difficulty IN ('again', 'good', 'easy'));

-- Add flashcard policies if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'flashcards' AND policyname = 'Users can view flashcards in their decks'
    ) THEN
        CREATE POLICY "Users can view flashcards in their decks" ON flashcards
            FOR SELECT USING (
                deck_id IN (
                    SELECT id FROM flashcard_decks WHERE user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'flashcards' AND policyname = 'Users can insert flashcards to their decks'
    ) THEN
        CREATE POLICY "Users can insert flashcards to their decks" ON flashcards
            FOR INSERT WITH CHECK (
                deck_id IN (
                    SELECT id FROM flashcard_decks WHERE user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'flashcards' AND policyname = 'Users can update flashcards in their decks'
    ) THEN
        CREATE POLICY "Users can update flashcards in their decks" ON flashcards
            FOR UPDATE USING (
                deck_id IN (
                    SELECT id FROM flashcard_decks WHERE user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'flashcards' AND policyname = 'Users can delete flashcards from their decks'
    ) THEN
        CREATE POLICY "Users can delete flashcards from their decks" ON flashcards
            FOR DELETE USING (
                deck_id IN (
                    SELECT id FROM flashcard_decks WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;
