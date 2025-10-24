-- Mock Exams tracking table
CREATE TABLE IF NOT EXISTS mock_exam_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_title TEXT NOT NULL,
  number_of_questions INTEGER,
  time_taken_minutes NUMERIC,
  grade VARCHAR(1) CHECK (grade IN ('E', 'D', 'C', 'B', 'A')),
  used_solution BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_mock_exam_sessions_user_id ON mock_exam_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_mock_exam_sessions_created_at ON mock_exam_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_mock_exam_sessions_user_created ON mock_exam_sessions(user_id, created_at);

-- Row-level security
ALTER TABLE mock_exam_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own exam sessions" ON mock_exam_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own exam sessions" ON mock_exam_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exam sessions" ON mock_exam_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exam sessions" ON mock_exam_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE TRIGGER update_mock_exam_sessions_updated_at BEFORE UPDATE ON mock_exam_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
