import React, { useEffect } from 'react';

// 监听滚动，给 html 添加 scrolled 类
function ScrollListener() {
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        document.documentElement.classList.add('scrolled');
      } else {
        document.documentElement.classList.remove('scrolled');
      }
    };

    // 初始检测
    handleScroll();
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return null;
}

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ScrollListener />
      {children}
    </>
  );
}
