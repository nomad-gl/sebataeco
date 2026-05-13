import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Phone, MapPin, Users, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";

export default function TeacherDirectory() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<"teacher" | "head_of_study" | "director" | "">();
  const [page, setPage] = useState(1);
  const limit = 12;

  const { data: result, isLoading } = trpc.teacherDirectory.getAllTeachers.useQuery({
    search: search || undefined,
    position: (position as any) || undefined,
    page,
    limit,
  });

  const positionLabel = (pos: string) => {
    const labels: Record<string, string> = {
      teacher: t("tp_position_teacher") || "Teacher",
      head_of_study: t("tp_position_hos") || "Head of Study",
      director: t("tp_position_director") || "Director",
      unassigned: t("tp_position_unassigned") || "Unassigned",
    };
    return labels[pos] || pos;
  };

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Users className="h-8 w-8" />
          {t("td_title") || "Teacher Directory"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("td_subtitle") || "Search and discover teachers in your network"}
        </p>
      </div>

      {/* Search and Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("td_search_placeholder") || "Search by name or email..."}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>

        <Select value={position || ""} onValueChange={(val) => {
          setPosition(val as any);
          setPage(1);
        }}>
          <SelectTrigger>
            <SelectValue placeholder={t("td_filter_position") || "Filter by position"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t("td_all_positions") || "All Positions"}</SelectItem>
            <SelectItem value="teacher">{t("tp_position_teacher") || "Teacher"}</SelectItem>
            <SelectItem value="head_of_study">{t("tp_position_hos") || "Head of Study"}</SelectItem>
            <SelectItem value="director">{t("tp_position_director") || "Director"}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results Count */}
      {result && (
        <div className="text-sm text-muted-foreground">
          {t("td_showing_results") || "Showing"} {(page - 1) * limit + 1}-{Math.min(page * limit, result.total)} {t("td_of") || "of"} {result.total} {t("td_teachers") || "teachers"}
        </div>
      )}

      {/* Teacher Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 space-y-3">
                <div className="h-6 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-4 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !result?.teachers.length ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground">{t("td_no_teachers_found") || "No teachers found"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {result.teachers.map((teacher) => (
            <Link key={teacher.id} href={`/teacher/profile/${teacher.id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{teacher.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">{positionLabel(teacher.position)}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {teacher.role === "director" ? "Director" : teacher.role === "head_of_study" ? "HOS" : "User"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Contact Info */}
                  <div className="space-y-2">
                    {teacher.email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4 flex-shrink-0" />
                        <a href={`mailto:${teacher.email}`} className="hover:text-foreground truncate">
                          {teacher.email}
                        </a>
                      </div>
                    )}

                    {teacher.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4 flex-shrink-0" />
                        <a href={`tel:${teacher.phone}`} className="hover:text-foreground">
                          {teacher.phone}
                        </a>
                      </div>
                    )}

                    {teacher.officeLocation && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 flex-shrink-0" />
                        <span>{teacher.officeLocation}</span>
                      </div>
                    )}
                  </div>

                  {/* Bio */}
                  {teacher.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{teacher.bio}</p>
                  )}

                  {/* View Profile Button */}
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    {t("td_view_profile") || "View Profile"}
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {result && result.pages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {t("td_previous") || "Previous"}
          </Button>

          <div className="text-sm text-muted-foreground">
            {t("td_page") || "Page"} {page} {t("td_of") || "of"} {result.pages}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(result.pages, p + 1))}
            disabled={page === result.pages}
          >
            {t("td_next") || "Next"}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Powered by SEBA */}
      <div className="text-center text-xs text-muted-foreground mt-8 pt-4 border-t">
        Powered by SEBA
      </div>
    </div>
  );
}
