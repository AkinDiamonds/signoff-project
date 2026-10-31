import React, { useRef } from 'react';
import { useTheme } from './ThemeProvider';
import { ThemePreset } from './themes';

export const ThemePickerSheet: React.FC = () => {
  const { preset, customColour, setTheme, isPickerOpen, closePicker } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isPickerOpen) return null;

  const presets: { id: Exclude<ThemePreset, 'custom'>; label: string; bg: string; dot: string; border?: string }[] = [
    { id: 'light', label: 'Light', bg: '#FFFFFF', dot: '#111111', border: '#D1D5DB' },
    { id: 'dark', label: 'Dark', bg: '#111111', dot: '#FFFFFF' },
    { id: 'orange', label: 'Orange', bg: '#FF4D15', dot: '#111111' },
    { id: 'green', label: 'Green', bg: '#10B981', dot: '#111111' },
    { id: 'blue', label: 'Blue', bg: '#2563EB', dot: '#FFFFFF' },
    { id: 'lime', label: 'Lime', bg: '#84CC16', dot: '#111111' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-picker-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closePicker();
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          maxWidth: '720px',
          width: '100%',
          padding: '40px 48px',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: '#111827',
          position: 'relative',
        }}
      >
        <button
          onClick={closePicker}
          aria-label="Close theme picker"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            border: 'none',
            background: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#6B7280',
            padding: '8px',
            borderRadius: '8px',
          }}
        >
          ✕
        </button>

        <p
          style={{
            margin: '0 0 8px 0',
            fontSize: '14px',
            color: '#6B7280',
            fontWeight: 500,
          }}
        >
          Before you look around
        </p>

        <h2
          id="theme-picker-title"
          style={{
            margin: '0 0 36px 0',
            fontSize: '38px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#111827',
          }}
        >
          Pick a colour for the site.
        </h2>

        {/* Donut presets */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            marginBottom: '36px',
          }}
        >
          {presets.map((item) => {
            const isSelected = preset === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTheme(item.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  outline: isSelected ? '2px solid #005BD3' : 'none',
                  outlineOffset: '4px',
                  borderRadius: '12px',
                }}
              >
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: item.bg,
                    border: item.border ? `1px solid ${item.border}` : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                    marginBottom: '10px',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: item.dot,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: isSelected ? 600 : 400,
                    color: isSelected ? '#111827' : '#4B5563',
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* Custom option */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => {
                fileInputRef.current?.click();
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                outline: preset === 'custom' ? '2px solid #005BD3' : 'none',
                outlineOffset: '4px',
                borderRadius: '12px',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background:
                    'conic-gradient(from 180deg at 50% 50%, #EF4444 0deg, #F59E0B 72deg, #10B981 144deg, #3B82F6 216deg, #8B5CF6 288deg, #EF4444 360deg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                  marginBottom: '10px',
                  border: '1px solid #D1D5DB',
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: customColour,
                    border: '2px solid #FFFFFF',
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: preset === 'custom' ? 600 : 400,
                  color: preset === 'custom' ? '#111827' : '#4B5563',
                }}
              >
                Custom
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="color"
              value={customColour}
              onChange={(e) => {
                setTheme('custom', e.target.value);
              }}
              style={{ opacity: 0, width: 0, height: 0, position: 'absolute', pointerEvents: 'none' }}
              aria-label="Pick custom colour"
            />
          </div>
        </div>

        {/* Footnote */}
        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: '13px',
            color: '#6B7280',
          }}
        >
          You can change it any time with the half-filled circle at the top right.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={closePicker}
            style={{
              backgroundColor: '#303030',
              color: '#FFFFFF',
              border: 'none',
              padding: '10px 24px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

