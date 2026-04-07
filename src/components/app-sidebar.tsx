import { NavMain } from '@/components/nav-main';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

import { MusicIcon, CableIcon, GaugeIcon, LibraryIcon } from 'lucide-react';

import type { LessonSource } from '@/features/musicxml/lessonCatalog';

type AppSidebarProps = {
  selectedLessonId: string;
  lessons: LessonSource[];
};

export function AppSidebar(props: AppSidebarProps) {
  const { selectedLessonId, lessons } = props;
  const lessonNavItems = lessons.map((lesson) => ({
    title: lesson.title,
    url: `#${lesson.id}`,
    isActive: lesson.id === selectedLessonId,
  }));

  const navItems = [
    {
      title: 'Lessons',
      url: '#',
      icon: <LibraryIcon />,
      isActive: true,
      items: lessonNavItems,
    },
    {
      title: 'Calibration',
      url: '#',
      icon: <GaugeIcon />,
    },
    {
      title: 'Input',
      url: '#',
      icon: <CableIcon />,
    },
  ];

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <MusicIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">MIDI</span>
                  <span className="truncate text-xs">Dynamics trainer</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
    </Sidebar>
  );
}
