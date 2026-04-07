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
import { getLessonPath } from '@/features/musicxml/lessonCatalog';
import { Link } from 'react-router';

type AppSidebarProps = {
  defaultLessonPath: string | null;
  selectedLessonId: string;
  lessons: LessonSource[];
};

export function AppSidebar(props: AppSidebarProps) {
  const { defaultLessonPath, selectedLessonId, lessons } = props;
  const lessonNavItems = lessons.map((lesson) => ({
    title: lesson.title,
    url: getLessonPath(lesson.id),
    isActive: lesson.id === selectedLessonId,
  }));

  const navItems = [
    {
      title: 'Lessons',
      url: defaultLessonPath ?? undefined,
      icon: <LibraryIcon />,
      isActive: true,
      items: lessonNavItems,
    },
    {
      title: 'Calibration',
      icon: <GaugeIcon />,
    },
    {
      title: 'Input',
      icon: <CableIcon />,
    },
  ];

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {defaultLessonPath ? (
              <SidebarMenuButton size="lg" asChild>
                <Link to={defaultLessonPath}>
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <MusicIcon className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">MIDI</span>
                    <span className="truncate text-xs">Dynamics trainer</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton size="lg" type="button">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <MusicIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">MIDI</span>
                  <span className="truncate text-xs">Dynamics trainer</span>
                </div>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
    </Sidebar>
  );
}
