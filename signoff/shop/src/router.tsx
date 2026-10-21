/**
 * Lightweight browser router for the storefront application.
 *
 * Supports HTML5 history API navigation, parameterized routes,
 * popstate events (browser back/forward button), and Link components.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface RouteMatch {
  path: string;
  params: Record<string, string>;
}

interface RouterContextType {
  path: string;
  params: Record<string, string>;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterContextType | null>(null);

function matchRoute(currentPath: string): RouteMatch {
  // Normalize trailing slash (except root)
  const norm = currentPath.length > 1 && currentPath.endsWith('/')
    ? currentPath.slice(0, -1)
    : currentPath;

  // Exact matches
  if (norm === '' || norm === '/') {
    return { path: '/', params: {} };
  }
  if (norm === '/cart') {
    return { path: '/cart', params: {} };
  }
  if (norm === '/checkout') {
    return { path: '/checkout', params: {} };
  }

  // /product/:sku
  const productMatch = /^\/product\/([^/]+)$/.exec(norm);
  if (productMatch && productMatch[1]) {
    return { path: '/product/:sku', params: { sku: productMatch[1] } };
  }

  // /confirmation/:code
  const confirmMatch = /^\/confirmation\/([^/]+)$/.exec(norm);
  if (confirmMatch && confirmMatch[1]) {
    return { path: '/confirmation/:code', params: { code: confirmMatch[1] } };
  }

  // Default to 404 or home
  return { path: norm, params: {} };
}

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/');

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((to: string) => {
    if (to !== window.location.pathname) {
      window.history.pushState({}, '', to);
      setCurrentPath(to);
      window.scrollTo(0, 0);
    }
  }, []);

  const { path, params } = matchRoute(currentPath);

  return (
    <RouterContext.Provider value={{ path, params, navigate }}>
      {children}
    </RouterContext.Provider>
  );
};

export function useRouter(): RouterContextType {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return ctx;
}

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  testId?: string;
  children: React.ReactNode;
}

export const Link: React.FC<LinkProps> = ({ to, testId, children, onClick, style, ...rest }) => {
  const { navigate } = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) {
      onClick(e);
    }
    // Allow normal browser behavior for meta/ctrl click (open new tab)
    if (!e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
      e.preventDefault();
      navigate(to);
    }
  };

  return (
    <a
      href={to}
      data-testid={testId}
      onClick={handleClick}
      style={{
        color: 'inherit',
        textDecoration: 'none',
        ...style,
      }}
      {...rest}
    >
      {children}
    </a>
  );
};
