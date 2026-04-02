import type { RefObject } from 'react';

type VexFlowScrollingStaffProps = {
  playheadRef: RefObject<HTMLDivElement | null>;
  renderRootRef: RefObject<HTMLDivElement | null>;
  staffHeight: number | null;
  viewportRef: RefObject<HTMLDivElement | null>;
};

function VexFlowScrollingStaff({
  playheadRef,
  renderRootRef,
  staffHeight,
  viewportRef,
}: VexFlowScrollingStaffProps) {
  return (
    <div
      ref={viewportRef}
      className="relative w-full overflow-hidden rounded-2xl border border-black/10 bg-white"
      style={staffHeight ? { height: staffHeight } : undefined}
    >
      <div ref={renderRootRef} className="absolute left-0 top-0" />
      <div
        ref={playheadRef}
        className="pointer-events-none absolute top-0 h-full w-px bg-red-500/80"
      />
    </div>
  );
}

export default VexFlowScrollingStaff;
