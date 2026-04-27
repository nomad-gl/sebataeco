import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  Search, Users, GraduationCap, ChevronLeft, ChevronRight,
  ExternalLink, BookOpen, Filter, X, ArrowLeft
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const PAGE_SIZE = 50;

const YEAR_GROUP_OPTIONS = [
  { value: "all", labelKey: "std_dir_filter_all_years" },
  { value: "infantil", labelKey: "std_dir_year_infantil" },
  { value: "junior", labelKey: "std_dir_year_junior" },
  { value: "primary", labelKey: "std_dir_year_primary" },
  { value: "secondary", labelKey: "std_dir_year_secondary" },
] as const;

const YEAR_GROUP_BADGE: Record<string, string> = {
  infantil: "bg-pink-100 text-pink-700 border-pink-200",
  junior: "bg-violet-100 text-violet-700 border-violet-200",
  primary: "bg-blue-100 text-blue-700 border-blue-200",
  secondary: "bg-teal-100 text-teal-700 border-teal-200",
};

export default function StudentDirectory() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [yearGroupFilter, setYearGroupFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset page when filter changes
  useEffect(() => { setPage(1); }, [yearGroupFilter]);

  // Role guard — only director and head_of_study
  useEffect(() => {
    if (!authLoading && user && !["admin", "director", "head_of_study"].includes(user.role)) {
      navigate("/");
    }
  }, [user, authLoading, navigate]);

  const { data, isLoading, isFetching } = trpc.director.listAllStudents.useQuery(
    {
      search: debouncedSearch || undefined,
      yearGroup: yearGroupFilter !== "all" ? yearGroupFilter : undefined,
      page,
      pageSize: PAGE_SIZE,
    },
    {}
  );

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  const clearFilters = useCallback(() => {
    setSearchInput("");
    setDebouncedSearch("");
    setYearGroupFilter("all");
    setPage(1);
  }, []);

  const hasFilters = searchInput.trim().length > 0 || yearGroupFilter !== "all";

  if (authLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-1 text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/director/overview")}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              {t("std_dir_back_to_menu")}
            </Button>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-primary" />
              {t("std_dir_title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("std_dir_desc")}</p>
          </div>
          {data && (
            <Badge variant="outline" className="self-start sm:self-auto text-sm px-3 py-1">
              <Users className="w-3.5 h-3.5 mr-1.5" />
              {data.total} {t("std_dir_total_label")}
            </Badge>
          )}
        </div>

        {/* Search + Filter bar */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-9 pr-9"
                  placeholder={t("std_dir_search_placeholder")}
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  autoComplete="off"
                />
                {searchInput && (
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setSearchInput("")}
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Year group filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
                <Select value={yearGroupFilter} onValueChange={setYearGroupFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEAR_GROUP_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {t(opt.labelKey as Parameters<typeof t>[0])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Clear filters */}
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0">
                  <X className="w-3.5 h-3.5 mr-1" />
                  {t("std_dir_clear_filters")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("std_dir_table_title")}</CardTitle>
            {isFetching && !isLoading && (
              <CardDescription className="text-xs text-muted-foreground animate-pulse">
                {t("std_dir_loading")}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !data || data.students.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">{t("std_dir_empty_title")}</p>
                <p className="text-sm mt-1">{t("std_dir_empty_desc")}</p>
                {hasFilters && (
                  <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                    {t("std_dir_clear_filters")}
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8 text-center">#</TableHead>
                      <TableHead>{t("std_dir_col_name")}</TableHead>
                      <TableHead>{t("std_dir_col_email")}</TableHead>
                      <TableHead>{t("std_dir_col_year")}</TableHead>
                      <TableHead>{t("std_dir_col_class")}</TableHead>
                      <TableHead className="text-center">{t("std_dir_col_details")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.students.map((student, idx) => (
                      <TableRow
                        key={student.id}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        {/* Row number */}
                        <TableCell className="text-center text-xs text-muted-foreground font-mono">
                          {(page - 1) * PAGE_SIZE + idx + 1}
                        </TableCell>

                        {/* Name */}
                        <TableCell className="font-medium">
                          {student.name}
                        </TableCell>

                        {/* Email */}
                        <TableCell className="text-sm text-muted-foreground">
                          {student.email}
                        </TableCell>

                        {/* Year / Level */}
                        <TableCell>
                          {student.yearGroup ? (
                            <Badge
                              variant="outline"
                              className={`text-xs ${YEAR_GROUP_BADGE[student.yearGroup] ?? ""}`}
                            >
                              {t(`std_dir_year_${student.yearGroup}` as Parameters<typeof t>[0])}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">{student.level}</span>
                          )}
                        </TableCell>

                        {/* Class name with link to group */}
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className="flex items-center gap-1 text-sm text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                                onClick={() => navigate(`/head-of-study/groups`)}
                              >
                                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                                {student.className}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {t("std_dir_class_link_tooltip")} #{student.groupId}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>

                        {/* Details link */}
                        <TableCell className="text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => navigate(`/director/students/${student.id}`)}
                              >
                                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                                {t("std_dir_view_details")}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {t("std_dir_view_details_tooltip")}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t("std_dir_page_info")
                .replace("{page}", String(page))
                .replace("{total}", String(totalPages))
                .replace("{count}", String(data?.total ?? 0))}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
                {t("std_dir_prev")}
              </Button>
              <span className="text-sm font-medium px-2">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                {t("std_dir_next")}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
