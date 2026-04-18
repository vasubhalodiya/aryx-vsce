import React, { useMemo } from 'react';

export default function Icon({ svg, size = 20, boxSize, className, style }) {
  const box = boxSize ?? size;

  const html = useMemo(() => svg
    .replace(/\bwidth="[^"]*"/, `width="${size}"`)
    .replace(/\bheight="[^"]*"/, `height="${size}"`),
    [svg, size]
  );

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: box,
        height: box,
        flexShrink: 0,
        ...style
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
