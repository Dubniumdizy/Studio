import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { useAuth } from './use-auth';

interface Widget {
  id: string;
  type: string;
  title: string;
  locked: boolean;
  minimized: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface WidgetLayout {
  widget_id: string;
  widget_type: string;
  title: string;
  locked: boolean;
  minimized: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function useWidgetPersistence(page: string = 'dashboard') {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  // Load widgets from Supabase
  const loadWidgets = useCallback(async (): Promise<Widget[]> => {
    if (!user) {
      setLoading(false);
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('widget_layouts')
        .select('*')
        .eq('user_id', user.id)
        .eq('page', page)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setLoading(false);
      return (data || []).map((layout: any) => ({
        id: layout.widget_id,
        type: layout.widget_type,
        title: layout.title,
        locked: layout.locked,
        minimized: layout.minimized,
        x: layout.x,
        y: layout.y,
        w: layout.w,
        h: layout.h,
      }));
    } catch (err: any) {
      console.error('Error loading widgets:', err);
      setError(err.message);
      setLoading(false);
      return [];
    }
  }, [user, page, supabase]);

  // Save widgets to Supabase
  const saveWidgets = useCallback(async (widgets: Widget[]) => {
    if (!user) return;

    try {
      // Delete existing widgets for this page
      await supabase
        .from('widget_layouts')
        .delete()
        .eq('user_id', user.id)
        .eq('page', page);

      // Insert new widgets
      const widgetLayouts = widgets.map((widget) => ({
        user_id: user.id,
        page,
        widget_id: widget.id,
        widget_type: widget.type,
        title: widget.title,
        locked: widget.locked,
        minimized: widget.minimized,
        x: widget.x,
        y: widget.y,
        w: widget.w,
        h: widget.h,
      }));

      const { error } = await supabase
        .from('widget_layouts')
        .insert(widgetLayouts);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error saving widgets:', err);
      setError(err.message);
    }
  }, [user, page, supabase]);

  // Update a single widget
  const updateWidget = useCallback(async (widgetId: string, updates: Partial<Widget>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('widget_layouts')
        .update({
          ...updates,
          widget_id: undefined, // Don't update the ID
          type: updates.type ? updates.type : undefined,
        })
        .eq('user_id', user.id)
        .eq('page', page)
        .eq('widget_id', widgetId);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error updating widget:', err);
      setError(err.message);
    }
  }, [user, page, supabase]);

  // Delete a widget
  const deleteWidget = useCallback(async (widgetId: string) => {
    if (!user) return;

    try {
      const { error} = await supabase
        .from('widget_layouts')
        .delete()
        .eq('user_id', user.id)
        .eq('page', page)
        .eq('widget_id', widgetId);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error deleting widget:', err);
      setError(err.message);
    }
  }, [user, page, supabase]);

  return {
    loading,
    error,
    loadWidgets,
    saveWidgets,
    updateWidget,
    deleteWidget,
  };
}

// Hook for storing arbitrary widget data
export function useWidgetData(widgetId: string) {
  const { user } = useAuth();
  const supabase = createClient();

  const saveData = useCallback(async (dataKey: string, dataValue: any) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('widget_data')
        .upsert({
          user_id: user.id,
          widget_id: widgetId,
          data_key: dataKey,
          data_value: dataValue,
        }, {
          onConflict: 'user_id,widget_id,data_key'
        });

      if (error) throw error;
    } catch (err: any) {
      console.error('Error saving widget data:', err);
    }
  }, [user, widgetId, supabase]);

  const loadData = useCallback(async (dataKey: string): Promise<any> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('widget_data')
        .select('data_value')
        .eq('user_id', user.id)
        .eq('widget_id', widgetId)
        .eq('data_key', dataKey)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
      return data?.data_value || null;
    } catch (err: any) {
      console.error('Error loading widget data:', err);
      return null;
    }
  }, [user, widgetId, supabase]);

  return { saveData, loadData };
}

// Hook for dashboard settings
export function useDashboardSettings() {
  const { user } = useAuth();
  const supabase = createClient();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('dashboard_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') throw error;
        setSettings(data || {});
      } catch (err) {
        console.error('Error loading dashboard settings:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user, supabase]);

  const saveSettings = useCallback(async (newSettings: any) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('dashboard_settings')
        .upsert({
          user_id: user.id,
          ...newSettings,
        });

      if (error) throw error;
      setSettings(newSettings);
    } catch (err) {
      console.error('Error saving dashboard settings:', err);
    }
  }, [user, supabase]);

  return { settings, saveSettings, loading };
}
