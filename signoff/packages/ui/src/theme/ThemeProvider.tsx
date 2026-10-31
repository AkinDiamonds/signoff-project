import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemePreset, applyTheme, getThemeConfig, ThemeConfig, THEMES } from './themes';

const STORAGE_KEY = 'signoff-theme';
const CUSTOM_KEY = 'signoff-theme-custom';
const FIRST_SEEN_KEY = 'signoff-theme-has-chosen';

export interface ThemeContextValue {
  preset: ThemePreset;
  customColour: string;
  themeConfig: ThemeConfig;
  isPickerOpen: boolean;
  openPicker: () => void;
  closePicker: () => void;
  setTheme: (preset: ThemePreset, customColour?: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preset, setPresetState] = useState<ThemePreset>(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'orange' || stored === 'green'
      || stored === 'blue' || stored === 'lime' || stored === 'custom') return stored;
    return 'light';
  });

  const [customColour, setCustomColourState] = useState<string>(() => {
    if (typeof window === 'undefined') return '#0F766E';
    return localStorage.getItem(CUSTOM_KEY) || '#0F766E';
  });

  // Appearance is opt-in; first visits and sign-in must never be blocked by a theme dialog.
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  useEffect(() => {
    applyTheme(preset, customColour);
  }, [preset, customColour]);

  const setTheme = (newPreset: ThemePreset, newCustomColour?: string) => {
    setPresetState(newPreset);
    localStorage.setItem(STORAGE_KEY, newPreset);
    localStorage.setItem(FIRST_SEEN_KEY, 'true');

    if (newCustomColour) {
      setCustomColourState(newCustomColour);
      localStorage.setItem(CUSTOM_KEY, newCustomColour);
    }

    applyTheme(newPreset, newCustomColour || customColour);
  };

  const openPicker = () => setIsPickerOpen(true);
  const closePicker = () => {
    localStorage.setItem(FIRST_SEEN_KEY, 'true');
    setIsPickerOpen(false);
  };

  const themeConfig = getThemeConfig(preset, customColour);

  return (
    <ThemeContext.Provider
      value={{
        preset,
        customColour,
        themeConfig,
        isPickerOpen,
        openPicker,
        closePicker,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

const defaultThemeContextValue: ThemeContextValue = {
  preset: 'light',
  customColour: '#0F766E',
  themeConfig: THEMES.light,
  isPickerOpen: false,
  openPicker: () => {},
  closePicker: () => {},
  setTheme: () => {},
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  return context || defaultThemeContextValue;
};

