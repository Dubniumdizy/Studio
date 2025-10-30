-- Widget and Dashboard Persistence Schema
-- Run this in your Supabase SQL editor after running supabase_schema.sql

-- Table for storing widget layouts and configurations
CREATE TABLE IF NOT EXISTS widget_layouts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    page VARCHAR(50) NOT NULL DEFAULT 'dashboard', -- 'dashboard', 'home', etc.
    widget_id TEXT NOT NULL,
    widget_type TEXT NOT NULL,
    title TEXT NOT NULL,
    locked BOOLEAN DEFAULT FALSE,
    minimized BOOLEAN DEFAULT FALSE,
    x INTEGER NOT NULL DEFAULT 0,
    y INTEGER NOT NULL DEFAULT 0,
    w INTEGER NOT NULL DEFAULT 4,
    h INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, page, widget_id)
);

-- Table for storing widget-specific data (notes, todos, etc.)
CREATE TABLE IF NOT EXISTS widget_data (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    widget_id TEXT NOT NULL,
    data_key TEXT NOT NULL,
    data_value JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, widget_id, data_key)
);

-- Table for quick notes widget
CREATE TABLE IF NOT EXISTS quick_notes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for todo items (mini widget)
CREATE TABLE IF NOT EXISTS todos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for checklist items
CREATE TABLE IF NOT EXISTS checklist_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    checked BOOLEAN DEFAULT FALSE,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for user questions
CREATE TABLE IF NOT EXISTS user_questions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    question TEXT NOT NULL,
    answer TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'resolved')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for dashboard settings
CREATE TABLE IF NOT EXISTS dashboard_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    header_image TEXT,
    theme_preference VARCHAR(20) DEFAULT 'default',
    default_page VARCHAR(50) DEFAULT 'dashboard',
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_widget_layouts_user_page ON widget_layouts(user_id, page);
CREATE INDEX IF NOT EXISTS idx_widget_data_user_widget ON widget_data(user_id, widget_id);
CREATE INDEX IF NOT EXISTS idx_quick_notes_user ON quick_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_user ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(user_id, completed);
CREATE INDEX IF NOT EXISTS idx_checklist_items_user ON checklist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_user_questions_user ON user_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_questions_status ON user_questions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_dashboard_settings_user ON dashboard_settings(user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_widget_layouts_updated_at BEFORE UPDATE ON widget_layouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_widget_data_updated_at BEFORE UPDATE ON widget_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quick_notes_updated_at BEFORE UPDATE ON quick_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_todos_updated_at BEFORE UPDATE ON todos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_checklist_items_updated_at BEFORE UPDATE ON checklist_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_questions_updated_at BEFORE UPDATE ON user_questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_settings_updated_at BEFORE UPDATE ON dashboard_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE widget_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for widget_layouts
CREATE POLICY "Users can view their own widget layouts" ON widget_layouts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own widget layouts" ON widget_layouts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own widget layouts" ON widget_layouts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own widget layouts" ON widget_layouts
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for widget_data
CREATE POLICY "Users can view their own widget data" ON widget_data
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own widget data" ON widget_data
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own widget data" ON widget_data
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own widget data" ON widget_data
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for quick_notes
CREATE POLICY "Users can view their own quick notes" ON quick_notes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quick notes" ON quick_notes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quick notes" ON quick_notes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quick notes" ON quick_notes
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for todos
CREATE POLICY "Users can view their own todos" ON todos
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own todos" ON todos
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own todos" ON todos
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own todos" ON todos
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for checklist_items
CREATE POLICY "Users can view their own checklist items" ON checklist_items
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own checklist items" ON checklist_items
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own checklist items" ON checklist_items
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own checklist items" ON checklist_items
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for user_questions
CREATE POLICY "Users can view their own questions" ON user_questions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own questions" ON user_questions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own questions" ON user_questions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own questions" ON user_questions
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for dashboard_settings
CREATE POLICY "Users can view their own dashboard settings" ON dashboard_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own dashboard settings" ON dashboard_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dashboard settings" ON dashboard_settings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dashboard settings" ON dashboard_settings
    FOR DELETE USING (auth.uid() = user_id);
