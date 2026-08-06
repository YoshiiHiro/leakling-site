import svgPaths from "./svg-928pdd1may";

function Branding() {
  return (
    <div className="[word-break:break-word] content-stretch flex flex-col gap-[2px] items-start leading-[normal] relative shrink-0 whitespace-nowrap" data-name="branding">
      <p className="font-['Geist:Bold',sans-serif] font-bold relative shrink-0 text-[18px] text-white tracking-[-0.18px]">Leakling</p>
      <p className="font-['Geist_Mono:SemiBold',sans-serif] font-semibold relative shrink-0 text-[#8e8e93] text-[10px] tracking-[1px]">DESKTOP</p>
    </div>
  );
}

function HeaderBar() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="header-bar">
      <Branding />
    </div>
  );
}

function TaglineSection() {
  return (
    <div className="[word-break:break-word] content-stretch flex flex-col gap-[12px] items-start relative shrink-0 w-full" data-name="tagline-section">
      <p className="font-['Geist:ExtraBold',sans-serif] font-extrabold leading-[normal] min-w-full relative shrink-0 text-[32px] text-white tracking-[-0.48px] w-[min-content]">Tag why you died. Find your leak.</p>
      <p className="font-['Geist:Regular',sans-serif] font-normal leading-[1.5] relative shrink-0 text-[#8e8e93] text-[15px] w-[640px]">Review your death-cause habits between queues. Set one specific focus to reduce tactical mistakes in your next match.</p>
    </div>
  );
}

function TabValorant() {
  return (
    <div className="bg-[rgba(0,0,0,0)] content-stretch flex gap-[8px] items-center px-[16px] py-[8px] relative rounded-[100px] shrink-0" data-name="tab-valorant">
      <div aria-hidden className="absolute border border-[rgba(255,255,255,0.05)] border-solid inset-0 pointer-events-none rounded-[100px]" />
      <p className="[word-break:break-word] font-['Geist:Medium',sans-serif] font-medium leading-[normal] relative shrink-0 text-[13px] text-white whitespace-nowrap">Valorant</p>
      <p className="[word-break:break-word] font-['Geist_Mono:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#545458] text-[11px] whitespace-nowrap">21640</p>
    </div>
  );
}

function TabOverlay() {
  return (
    <div className="bg-[rgba(0,0,0,0)] content-stretch flex gap-[8px] items-center px-[16px] py-[8px] relative rounded-[100px] shrink-0" data-name="tab-overlay">
      <div aria-hidden className="absolute border border-[rgba(255,255,255,0.05)] border-solid inset-0 pointer-events-none rounded-[100px]" />
      <p className="[word-break:break-word] font-['Geist:Medium',sans-serif] font-medium leading-[normal] relative shrink-0 text-[13px] text-white whitespace-nowrap">Overlay</p>
      <p className="[word-break:break-word] font-['Geist_Mono:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#545458] text-[11px] whitespace-nowrap">Ctrl+Shift+A</p>
    </div>
  );
}

function TabMock() {
  return (
    <div className="bg-[#16161a] content-stretch flex gap-[8px] items-center px-[16px] py-[8px] relative rounded-[100px] shrink-0" data-name="tab-mock">
      <div aria-hidden className="absolute border border-[#9d4edd] border-solid inset-0 pointer-events-none rounded-[100px] shadow-[0px_0px_2px_0px_#9d4edd,3px_3px_12px_0px_rgba(123,44,191,0.3),-3px_-3px_6px_0px_rgba(255,255,255,0.05)]" />
      <p className="[word-break:break-word] font-['Geist:SemiBold',sans-serif] font-semibold leading-[normal] relative shrink-0 text-[13px] text-white whitespace-nowrap">Mock</p>
      <p className="[word-break:break-word] font-['Geist_Mono:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#9d4edd] text-[11px] whitespace-nowrap">Ctrl+Shift+D</p>
    </div>
  );
}

function TabsRow() {
  return (
    <div className="content-stretch flex gap-[12px] items-center relative shrink-0 w-full" data-name="tabs-row">
      <TabValorant />
      <TabOverlay />
      <TabMock />
    </div>
  );
}

function Switch() {
  return (
    <div className="h-[22px] relative shrink-0 w-[42px]" data-name="switch">
      <div className="absolute inset-[-40.91%_-35.71%_-68.18%_-21.43%]">
        <svg className="block size-full" fill="none" height="46" preserveAspectRatio="none" viewBox="0 0 66 46" width="66">
          <g filter="url(#filter0_ddd_1_85)" id="switch">
            <rect fill="var(--fill-0, #9D4EDD)" height="22" rx="11" shapeRendering="crispEdges" width="42" x="9" y="9" />
            <g id="Ellipse" />
          </g>
          <defs>
            <filter colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse" height="46" id="filter0_ddd_1_85" width="66" x="0" y="0">
              <feFlood floodOpacity="0" result="BackgroundImageFix" />
              <feColorMatrix in="SourceAlpha" result="hardAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" />
              <feOffset dx="-3" dy="-3" />
              <feGaussianBlur stdDeviation="3" />
              <feComposite in2="hardAlpha" operator="out" />
              <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.0470588 0" />
              <feBlend in2="BackgroundImageFix" mode="normal" result="effect1_dropShadow_1_85" />
              <feColorMatrix in="SourceAlpha" result="hardAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" />
              <feOffset dx="3" dy="3" />
              <feGaussianBlur stdDeviation="6" />
              <feComposite in2="hardAlpha" operator="out" />
              <feColorMatrix type="matrix" values="0 0 0 0 0.482353 0 0 0 0 0.172549 0 0 0 0 0.74902 0 0 0 0.301961 0" />
              <feBlend in2="effect1_dropShadow_1_85" mode="normal" result="effect2_dropShadow_1_85" />
              <feColorMatrix in="SourceAlpha" result="hardAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" />
              <feOffset />
              <feGaussianBlur stdDeviation="1" />
              <feComposite in2="hardAlpha" operator="out" />
              <feColorMatrix type="matrix" values="0 0 0 0 0.615686 0 0 0 0 0.305882 0 0 0 0 0.866667 0 0 0 1 0" />
              <feBlend in2="effect2_dropShadow_1_85" mode="normal" result="effect3_dropShadow_1_85" />
              <feBlend in="SourceGraphic" in2="effect3_dropShadow_1_85" mode="normal" result="shape" />
            </filter>
          </defs>
        </svg>
      </div>
    </div>
  );
}

function ToggleWrapper() {
  return (
    <div className="content-stretch flex gap-[10px] items-center relative shrink-0" data-name="toggle-wrapper">
      <p className="[word-break:break-word] font-['Geist:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#8e8e93] text-[13px] whitespace-nowrap">Mock mode</p>
      <Switch />
    </div>
  );
}

function CardHeader() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="card-header">
      <p className="[word-break:break-word] font-['Geist_Mono:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[#8e8e93] text-[11px] whitespace-nowrap">MOCK CONTROLS</p>
      <ToggleWrapper />
    </div>
  );
}

function Skull() {
  return (
    <div className="relative shrink-0 size-[14px]" data-name="skull">
      <svg className="absolute block inset-0 size-full" fill="none" height="14" preserveAspectRatio="none" viewBox="0 0 14 14" width="14">
        <g id="skull">
          <path d={svgPaths.p2869a500} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}

function Button() {
  return (
    <div className="bg-[#240046] content-stretch flex gap-[8px] items-center px-[16px] py-[10px] relative rounded-[10px] shrink-0" data-name="button">
      <div aria-hidden className="absolute border border-[#9d4edd] border-solid inset-0 pointer-events-none rounded-[10px] shadow-[0px_0px_2px_0px_#9d4edd,3px_3px_12px_0px_rgba(123,44,191,0.3),-3px_-3px_6px_0px_rgba(255,255,255,0.05)]" />
      <Skull />
      <p className="[word-break:break-word] font-['Geist:SemiBold',sans-serif] font-semibold leading-[normal] relative shrink-0 text-[13px] text-white whitespace-nowrap">Simulate death</p>
    </div>
  );
}

function Tag() {
  return (
    <div className="relative shrink-0 size-[14px]" data-name="tag">
      <svg className="absolute block inset-0 size-full" fill="none" height="14" preserveAspectRatio="none" viewBox="0 0 14 14" width="14">
        <g clipPath="url(#clip0_1_97)" id="tag">
          <path d={svgPaths.p3b8ef970} id="Vector" stroke="var(--stroke-0, #8E8E93)" strokeLinecap="round" strokeWidth="2" />
        </g>
        <defs>
          <clipPath id="clip0_1_97">
            <rect fill="white" height="14" width="14" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Button1() {
  return (
    <div className="bg-[#16161a] content-stretch flex gap-[8px] items-center px-[16px] py-[10px] relative rounded-[10px] shrink-0" data-name="button">
      <div aria-hidden className="absolute border border-[rgba(255,255,255,0.05)] border-solid inset-0 pointer-events-none rounded-[10px] shadow-[4px_4px_8px_0px_rgba(0,0,0,0.31),-4px_-4px_8px_0px_rgba(255,255,255,0.03)]" />
      <Tag />
      <p className="[word-break:break-word] font-['Geist:SemiBold',sans-serif] font-semibold leading-[normal] relative shrink-0 text-[13px] text-white whitespace-nowrap">Simulate + tag</p>
    </div>
  );
}

function StopCircle() {
  return (
    <div className="relative shrink-0 size-[14px]" data-name="stop-circle">
      <svg className="absolute block inset-0 size-full" fill="none" height="14" preserveAspectRatio="none" viewBox="0 0 14 14" width="14">
        <g clipPath="url(#clip0_1_94)" id="stop-circle">
          <path d={svgPaths.p33911600} id="Vector" stroke="var(--stroke-0, #8E8E93)" strokeLinecap="round" strokeWidth="2" />
        </g>
        <defs>
          <clipPath id="clip0_1_94">
            <rect fill="white" height="14" width="14" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Button2() {
  return (
    <div className="bg-[#16161a] content-stretch flex gap-[8px] items-center px-[16px] py-[10px] relative rounded-[10px] shrink-0" data-name="button">
      <div aria-hidden className="absolute border border-[rgba(255,255,255,0.05)] border-solid inset-0 pointer-events-none rounded-[10px] shadow-[4px_4px_8px_0px_rgba(0,0,0,0.31),-4px_-4px_8px_0px_rgba(255,255,255,0.03)]" />
      <StopCircle />
      <p className="[word-break:break-word] font-['Geist:SemiBold',sans-serif] font-semibold leading-[normal] relative shrink-0 text-[13px] text-white whitespace-nowrap">End mock match</p>
    </div>
  );
}

function Trash() {
  return (
    <div className="relative shrink-0 size-[14px]" data-name="trash-2">
      <svg className="absolute block inset-0 size-full" fill="none" height="14" preserveAspectRatio="none" viewBox="0 0 14 14" width="14">
        <g clipPath="url(#clip0_1_88)" id="trash-2">
          <path d={svgPaths.p234d2680} id="Vector" stroke="var(--stroke-0, #FF4D6D)" strokeLinecap="round" strokeWidth="2" />
        </g>
        <defs>
          <clipPath id="clip0_1_88">
            <rect fill="white" height="14" width="14" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Button3() {
  return (
    <div className="bg-[#16161a] content-stretch flex gap-[8px] items-center px-[16px] py-[10px] relative rounded-[10px] shrink-0" data-name="button">
      <div aria-hidden className="absolute border border-[rgba(230,57,70,0.3)] border-solid inset-0 pointer-events-none rounded-[10px] shadow-[4px_4px_8px_0px_rgba(0,0,0,0.31),-4px_-4px_8px_0px_rgba(255,255,255,0.03)]" />
      <Trash />
      <p className="[word-break:break-word] font-['Geist:SemiBold',sans-serif] font-semibold leading-[normal] relative shrink-0 text-[#ff4d6d] text-[13px] whitespace-nowrap">Reset all data</p>
    </div>
  );
}

function ActionButtonsRow() {
  return (
    <div className="content-center flex flex-wrap gap-[12px] items-center relative shrink-0 w-full" data-name="action-buttons-row">
      <Button />
      <Button1 />
      <Button2 />
      <Button3 />
    </div>
  );
}

function Skull1() {
  return (
    <div className="relative shrink-0 size-[14px]" data-name="skull">
      <svg className="absolute block inset-0 size-full" fill="none" height="14" preserveAspectRatio="none" viewBox="0 0 14 14" width="14">
        <g id="skull">
          <path d={svgPaths.p2869a500} id="Vector" stroke="var(--stroke-0, #9D4EDD)" strokeLinecap="round" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}

function StatusContainer() {
  return (
    <div className="relative rounded-[12px] shrink-0 w-full" data-name="status-container">
      <div aria-hidden className="absolute bg-[#0b0b0d] inset-0 pointer-events-none rounded-[12px]" />
      <div aria-hidden className="absolute border border-[rgba(0,0,0,0.5)] border-solid inset-0 pointer-events-none rounded-[12px]" />
      <div className="content-stretch flex gap-[10px] items-start p-[12px] relative size-full">
        <Skull1 />
        <p className="[word-break:break-word] font-['Geist_Mono:Regular',sans-serif] font-normal leading-[0] relative shrink-0 text-[12px] text-white whitespace-nowrap">
          <span className="leading-[normal]">{`Death simulated — `}</span>
          <span className="leading-[normal] text-[#9d4edd]">overlay shown</span>
          <span className="leading-[normal]">{` (6s)`}</span>
        </p>
      </div>
      <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_2px_2px_4px_0px_rgba(0,0,0,0.5)]" />
    </div>
  );
}

function MockControlsCard() {
  return (
    <div className="bg-[#16161a] relative rounded-[20px] shrink-0 w-full" data-name="mock-controls-card">
      <div aria-hidden className="absolute border border-[rgba(255,255,255,0.05)] border-solid inset-0 pointer-events-none rounded-[20px] shadow-[4px_4px_8px_0px_rgba(0,0,0,0.31),-4px_-4px_8px_0px_rgba(255,255,255,0.03)]" />
      <div className="content-stretch flex flex-col gap-[20px] items-start p-[24px] relative size-full">
        <CardHeader />
        <ActionButtonsRow />
        <StatusContainer />
      </div>
    </div>
  );
}

function ChevronDown() {
  return (
    <div className="relative shrink-0 size-[12px]" data-name="chevron-down">
      <svg className="absolute block inset-0 size-full" fill="none" height="12" preserveAspectRatio="none" viewBox="0 0 12 12" width="12">
        <g id="chevron-down">
          <path d="M3 4.5L6 7.5L9 4.5" id="Vector" stroke="var(--stroke-0, #8E8E93)" strokeLinecap="round" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}

function DropdownSelector() {
  return (
    <div className="bg-[#0b0b0d] content-stretch flex gap-[20px] items-center px-[16px] py-[10px] relative rounded-[10px] shrink-0" data-name="dropdown-selector">
      <div aria-hidden className="absolute border border-[rgba(255,255,255,0.05)] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <p className="[word-break:break-word] font-['Geist_Mono:Medium',sans-serif] font-medium leading-[normal] relative shrink-0 text-[13px] text-white whitespace-nowrap">— clear —</p>
      <ChevronDown />
    </div>
  );
}

function DropdownGroup() {
  return (
    <div className="content-stretch flex gap-[12px] items-center relative shrink-0" data-name="dropdown-group">
      <p className="[word-break:break-word] font-['Geist:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#8e8e93] text-[13px] whitespace-nowrap">Set focus</p>
      <DropdownSelector />
    </div>
  );
}

function FocusContent() {
  return (
    <div className="content-stretch flex items-center justify-between relative shrink-0 w-full" data-name="focus-content">
      <p className="[word-break:break-word] font-['Geist:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[20px] text-white whitespace-nowrap">No focus set</p>
      <DropdownGroup />
    </div>
  );
}

function FocusCard() {
  return (
    <div className="bg-[#16161a] relative rounded-[20px] shrink-0 w-full" data-name="focus-card">
      <div aria-hidden className="absolute border border-[rgba(255,255,255,0.05)] border-solid inset-0 pointer-events-none rounded-[20px] shadow-[4px_4px_8px_0px_rgba(0,0,0,0.31),-4px_-4px_8px_0px_rgba(255,255,255,0.03)]" />
      <div className="content-stretch flex flex-col gap-[16px] items-start p-[24px] relative size-full">
        <p className="[word-break:break-word] font-['Geist_Mono:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[#8e8e93] text-[11px] w-full">NEXT-MATCH FOCUS</p>
        <FocusContent />
      </div>
    </div>
  );
}

function BreakdownPlaceholder() {
  return (
    <div className="flex-[1_0_0] min-h-px relative w-full" data-name="breakdown-placeholder">
      <div className="flex flex-col items-center justify-center size-full">
        <div className="content-stretch flex flex-col items-center justify-center p-[16px] relative size-full">
          <p className="[word-break:break-word] font-['Geist:Regular',sans-serif] font-normal leading-[normal] relative shrink-0 text-[#545458] text-[14px] text-center w-full">Die, review, find your leak</p>
        </div>
      </div>
    </div>
  );
}

function BreakdownCard() {
  return (
    <div className="bg-[#16161a] flex-[1_0_0] min-h-[160px] min-w-px relative rounded-[20px] self-stretch" data-name="breakdown-card">
      <div aria-hidden className="absolute border border-[rgba(255,255,255,0.05)] border-solid inset-0 pointer-events-none rounded-[20px] shadow-[4px_4px_8px_0px_rgba(0,0,0,0.31),-4px_-4px_8px_0px_rgba(255,255,255,0.03)]" />
      <div className="content-stretch flex flex-col gap-[16px] items-start min-h-[inherit] p-[24px] relative size-full">
        <p className="[word-break:break-word] font-['Geist_Mono:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[#8e8e93] text-[11px] w-full">CAUSE BREAKDOWN</p>
        <BreakdownPlaceholder />
      </div>
    </div>
  );
}

function TagItem() {
  return (
    <div className="bg-[#0b0b0d] relative rounded-[10px] shrink-0 w-full" data-name="tag-item">
      <div className="flex flex-row items-center size-full">
        <div className="[word-break:break-word] content-stretch flex items-center justify-between leading-[normal] p-[12px] relative size-full whitespace-nowrap">
          <p className="font-['Geist:SemiBold',sans-serif] font-semibold relative shrink-0 text-[#8e8e93] text-[13px]">Skipped</p>
          <p className="font-['Geist_Mono:Regular',sans-serif] font-normal relative shrink-0 text-[#545458] text-[12px]">R1 - attack · 10:51:20 PM</p>
        </div>
      </div>
    </div>
  );
}

function TagsList() {
  return (
    <div className="content-stretch flex flex-col items-start relative shrink-0 w-full" data-name="tags-list">
      <TagItem />
    </div>
  );
}

function RecentTagsCard() {
  return (
    <div className="bg-[#16161a] flex-[1_0_0] min-h-[160px] min-w-px relative rounded-[20px] self-stretch" data-name="recent-tags-card">
      <div aria-hidden className="absolute border border-[rgba(255,255,255,0.05)] border-solid inset-0 pointer-events-none rounded-[20px] shadow-[4px_4px_8px_0px_rgba(0,0,0,0.31),-4px_-4px_8px_0px_rgba(255,255,255,0.03)]" />
      <div className="content-stretch flex flex-col gap-[16px] items-start min-h-[inherit] p-[24px] relative size-full">
        <p className="[word-break:break-word] font-['Geist_Mono:Bold',sans-serif] font-bold leading-[normal] relative shrink-0 text-[#8e8e93] text-[11px] w-full">RECENT TAGS</p>
        <TagsList />
      </div>
    </div>
  );
}

function BottomRow() {
  return (
    <div className="content-stretch flex gap-[24px] h-[160px] items-start relative shrink-0 w-full" data-name="bottom-row">
      <BreakdownCard />
      <RecentTagsCard />
    </div>
  );
}

export default function LeaklingNeumorphism() {
  return (
    <div className="bg-[#0f0f12] content-stretch flex flex-col gap-[24px] items-start p-[32px] relative size-full" data-name="leakling-neumorphism">
      <HeaderBar />
      <TaglineSection />
      <TabsRow />
      <MockControlsCard />
      <FocusCard />
      <BottomRow />
    </div>
  );
}