import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Plus, FileText, Users, Clock, Trash2, Lock, LockOpen, Pencil, Check, X, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose
} from "@/components/ui/dialog";

interface ProjectManagementProps {
  currentUser?: any;
}

const ProjectManagement = ({ currentUser }: ProjectManagementProps) => {
  const { t } = useLanguage();
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    client: "",
    status: "active"
  });

  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<any>(null);

  // Projects state from Supabase
  const [projects, setProjects] = useState<any[]>([]);
  // Map of projectId -> total hours
  const [projectHours, setProjectHours] = useState<Record<number, number>>({});
  // Time entries for modal
  const [modalEntries, setModalEntries] = useState<any[]>([]);
  const [modalProject, setModalProject] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  // Edit project name state
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editedProjectName, setEditedProjectName] = useState<string>("");
  // Search state
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Fetch projects from Supabase on mount
  useEffect(() => {
    const fetchProjects = async () => {
      const { data, error } = await supabase.from("projects").select("*");
      if (error) {
        toast({
          title: "Error loading projects",
          description: error.message,
          variant: "destructive",
        });
      } else if (data) {
        // Show all projects (both global and user-specific) in ProjectManagement
        setProjects(data);
      }
    };
    fetchProjects();
  }, [toast]);

  // Fetch total hours for each project
  useEffect(() => {
    const fetchHours = async () => {
      if (projects.length === 0) return;
      // Timesheet uses 'project' (name as string), not 'project_id'
      const { data, error } = await supabase.from("timesheet").select("project, hours");
      if (data) {
        const hoursMap: Record<number, number> = {};
        // Match timesheet entries by project name to project id
        data.forEach((entry: { project: string | null; hours: number }) => {
          if (!entry.project) return; // Skip entries without project
          // Find project by name
          const matchingProject = projects.find(p => p.name === entry.project);
          if (matchingProject) {
            if (!hoursMap[matchingProject.id]) hoursMap[matchingProject.id] = 0;
            hoursMap[matchingProject.id] += Number(entry.hours) || 0;
          }
        });
        setProjectHours(hoursMap);
      }
    };
    fetchHours();
  }, [projects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name || !newProject.client) {
      toast({
        title: "Missing Information",
        description: "Please fill in project name and client",
        variant: "destructive",
      });
      return;
    }
    // Insert new project into Supabase
    const { error } = await supabase.from("projects").insert([newProject]);
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    // Fetch updated projects list
    const { data: updatedProjects } = await supabase.from("projects").select("*");
    setProjects(updatedProjects || []);
    toast({
      title: "Project Created",
      description: `${newProject.name} has been added successfully`,
    });
    setNewProject({
      name: "",
      description: "",
      client: "",
      status: "active"
    });
  };

  // Open modal and fetch time entries for a project
  const handleViewDetails = async (project: any) => {
    setModalProject(project);
    setModalOpen(true);
    // Timesheet uses 'project' (name as string), not 'project_id'
    const { data, error } = await supabase
      .from("timesheet")
      .select("*, users(name, email)")
      .eq("project", project.name);
    
    if (error) {
      console.error("Error fetching project details:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
    
    setModalEntries(data || []);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200";
      case "closed":
        return "bg-red-100 text-red-800 border-red-200";
      case "completed":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "on-hold":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const handleCloseProject = async (project: any) => {
    if (!currentUser?.isAdmin) {
      toast({
        title: "Geen Toegang",
        description: "Alleen admins kunnen projecten sluiten.",
        variant: "destructive",
      });
      return;
    }

    const newStatus = project.status === "closed" ? "active" : "closed";
    const { error } = await supabase
      .from("projects")
      .update({ status: newStatus })
      .eq("id", project.id);

    if (error) {
      toast({
        title: "Fout",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: newStatus === "closed" ? "Project Gesloten" : "Project Heropend",
        description: `${project.name} is ${newStatus === "closed" ? "gesloten" : "heropend"}. ${newStatus === "closed" ? "Er kunnen geen uren meer aan toegevoegd worden." : "Er kunnen weer uren aan toegevoegd worden."}`,
      });
      // Refresh projects list
      const { data: updatedProjects } = await supabase.from("projects").select("*");
      setProjects(updatedProjects || []);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    
    // Check if user is admin
    if (!currentUser?.isAdmin) {
      toast({
        title: "Geen Toegang",
        description: "Alleen admins kunnen projecten verwijderen.",
        variant: "destructive",
      });
      setDeleteConfirmOpen(false);
      return;
    }

    // Delete all timesheet entries for this project first
    // Try both project name and project_id (depending on how entries are stored)
    const { error: timesheetErrorByName } = await supabase
      .from("timesheet")
      .delete()
      .eq("project", projectToDelete.name);
    
    // Also try deleting by project_id if it exists in timesheet
    const { error: timesheetErrorById } = await supabase
      .from("timesheet")
      .delete()
      .eq("project_id", projectToDelete.id);
    
    if (timesheetErrorByName && timesheetErrorById) {
      console.warn("Error deleting timesheet entries:", timesheetErrorByName, timesheetErrorById);
      // Continue anyway - project might not have entries
    }

    // Delete the project
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectToDelete.id);
    
    if (error) {
      toast({
        title: "Fout bij Verwijderen",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: t('project.deleted'),
        description: t('project.deletedText', { name: projectToDelete.name }),
      });
      // Refresh projects list
      const { data: updatedProjects } = await supabase
        .from("projects")
        .select("*")
        .is("user_id", null);
      setProjects(updatedProjects || []);
      // Refresh project hours
      setProjectHours({});
    }
    
    setDeleteConfirmOpen(false);
    setProjectToDelete(null);
  };

  const openDeleteConfirm = (project: any) => {
    if (!currentUser?.isAdmin) {
      toast({
        title: "Geen Toegang",
        description: "Alleen admins kunnen projecten verwijderen.",
        variant: "destructive",
      });
      return;
    }
    setProjectToDelete(project);
    setDeleteConfirmOpen(true);
  };

  const handleStartEdit = (project: any) => {
    if (!currentUser?.isAdmin) {
      toast({
        title: "Geen Toegang",
        description: "Alleen admins kunnen projectnamen bewerken.",
        variant: "destructive",
      });
      return;
    }
    setEditingProjectId(project.id);
    setEditedProjectName(project.name);
  };

  const handleCancelEdit = () => {
    setEditingProjectId(null);
    setEditedProjectName("");
  };

  const handleSaveEdit = async (project: any) => {
    if (!currentUser?.isAdmin) {
      toast({
        title: "Geen Toegang",
        description: "Alleen admins kunnen projectnamen bewerken.",
        variant: "destructive",
      });
      return;
    }

    if (!editedProjectName.trim()) {
      toast({
        title: "Fout",
        description: "Projectnaam mag niet leeg zijn.",
        variant: "destructive",
      });
      return;
    }

    const oldName = project.name;
    const newName = editedProjectName.trim();

    if (oldName === newName) {
      handleCancelEdit();
      return;
    }

    try {
      // Update project name in projects table
      const { error: projectError } = await supabase
        .from("projects")
        .update({ name: newName })
        .eq("id", project.id);

      if (projectError) {
        throw projectError;
      }

      // Update all timesheet entries that reference the old project name
      const { error: timesheetError } = await supabase
        .from("timesheet")
        .update({ project: newName })
        .eq("project", oldName);

      if (timesheetError) {
        console.warn("Error updating timesheet entries:", timesheetError);
        // Continue anyway - project name is updated
      }

      toast({
        title: "Projectnaam Bijgewerkt",
        description: `Projectnaam is gewijzigd van "${oldName}" naar "${newName}". Alle gerelateerde timesheet entries zijn ook bijgewerkt.`,
      });

      // Refresh projects list
      const { data: updatedProjects } = await supabase.from("projects").select("*");
      setProjects(updatedProjects || []);

      // Refresh project hours
      const { data: timesheetData } = await supabase.from("timesheet").select("project, hours");
      if (timesheetData) {
        const hoursMap: Record<number, number> = {};
        timesheetData.forEach((entry: { project: string | null; hours: number }) => {
          if (!entry.project) return;
          const matchingProject = (updatedProjects || []).find(p => p.name === entry.project);
          if (matchingProject) {
            if (!hoursMap[matchingProject.id]) hoursMap[matchingProject.id] = 0;
            hoursMap[matchingProject.id] += Number(entry.hours) || 0;
          }
        });
        setProjectHours(hoursMap);
      }

      handleCancelEdit();
    } catch (error: any) {
      toast({
        title: "Fout",
        description: error.message || "Er is een fout opgetreden bij het bijwerken van de projectnaam.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className={`grid grid-cols-1 ${isMobile ? '' : 'lg:grid-cols-3'} gap-4 sm:gap-6 lg:gap-8`}>
      {/* Add New Project */}
      <Card className={`${isMobile ? '' : 'lg:col-span-1'} shadow-lg border-blue-100 dark:border-blue-800`}>
        <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-t-lg p-4 sm:p-6">
          <CardTitle className="flex items-center text-blue-900 dark:text-blue-100 text-lg sm:text-xl">
            <Plus className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3" />
            {t('project.addNew')}
          </CardTitle>
          <CardDescription className="text-blue-700 text-sm">
            {t('project.create')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div className="space-y-2">
              <Label htmlFor="projectName" className="text-sm text-gray-700 dark:text-gray-300 font-medium">{t('project.name')}</Label>
              <Input
                id="projectName"
                placeholder={t('project.namePlaceholder')}
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                required
                className="h-10 sm:h-9 border-blue-200 dark:border-blue-700 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client" className="text-sm text-gray-700 dark:text-gray-300 font-medium">{t('project.client')}</Label>
              <Input
                id="client"
                placeholder={t('project.clientPlaceholder')}
                value={newProject.client}
                onChange={(e) => setNewProject({ ...newProject, client: e.target.value })}
                required
                className="h-10 sm:h-9 border-blue-200 dark:border-blue-700 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm text-gray-700 dark:text-gray-300 font-medium">{t('project.description')}</Label>
              <Textarea
                id="description"
                placeholder={t('project.descriptionPlaceholder')}
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                className="min-h-[80px] border-blue-200 dark:border-blue-700 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>
            <Button type="submit" className="w-full h-10 sm:h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-lg" size={isMobile ? "lg" : "default"}>
              <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              {t('project.createButton')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Projects List */}
      <div className={`${isMobile ? '' : 'lg:col-span-2'} space-y-4 sm:space-y-6`}>
        <Card className="shadow-lg border-blue-100 dark:border-blue-800">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-t-lg p-4 sm:p-6">
            <CardTitle className="flex items-center text-blue-900 dark:text-blue-100 text-lg sm:text-xl">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3" />
              {t('project.active')}
            </CardTitle>
            <CardDescription className="text-blue-700 text-sm">
              {t('project.manage')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {/* Search Input */}
            <div className="mb-4 sm:mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Zoek projecten..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 sm:h-9 border-blue-200 dark:border-blue-700 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>
            </div>
            <div className="space-y-4 sm:space-y-6">
              {projects
                .filter((project) => {
                  if (!searchQuery.trim()) return true;
                  const query = searchQuery.toLowerCase();
                  return (
                    project.name?.toLowerCase().includes(query) ||
                    project.client?.toLowerCase().includes(query) ||
                    project.description?.toLowerCase().includes(query)
                  );
                })
                .map((project) => (
                <div key={project.id} className="border border-blue-100 dark:border-blue-800 rounded-xl p-4 sm:p-6 hover:shadow-md transition-all bg-gradient-to-r from-white to-blue-50 dark:from-gray-800 dark:to-blue-900/20">
                  <div className={`flex ${isMobile ? 'flex-col' : 'justify-between items-start'} gap-3 mb-4`}>
                    <div className="flex-1 w-full">
                      {editingProjectId === project.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editedProjectName}
                            onChange={(e) => setEditedProjectName(e.target.value)}
                            className="text-lg sm:text-xl font-bold h-9 sm:h-10"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSaveEdit(project);
                              } else if (e.key === "Escape") {
                                handleCancelEdit();
                              }
                            }}
                            autoFocus
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSaveEdit(project)}
                            className="h-9 sm:h-10 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/40"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelEdit}
                            className="h-9 sm:h-10 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/40"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">{project.name}</h3>
                          {currentUser?.isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStartEdit(project)}
                              className="h-7 w-7 p-0 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                              title="Edit project name"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                      <p className="text-sm sm:text-base text-blue-700 dark:text-blue-300 font-medium">{project.client}</p>
                    </div>
                    <Badge className={`${getStatusColor(project.status || "active")} border font-medium text-xs`}>
                      {project.status === "closed" ? "Closed" : project.status || "Active"}
                    </Badge>
                  </div>
                  <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">{project.description}</p>
                    <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'} gap-3 sm:gap-0 text-xs sm:text-sm text-gray-600 dark:text-gray-400`}>
                    <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} ${isMobile ? 'gap-2' : 'space-x-6'}`}>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-blue-600 dark:text-blue-400" />
                        <span className="font-medium text-gray-900 dark:text-gray-100">{t('project.hoursLogged', { hours: String(projectHours[project.id] || 0) })}</span>
                      </div>
                      <div className="flex items-center">
                        <Users className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-blue-600 dark:text-blue-400" />
                        <span className="font-medium text-gray-900 dark:text-gray-100">{t('project.members')}</span>
                      </div>
                    </div>
                    <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} ${isMobile ? 'gap-2' : 'gap-2'} w-full ${isMobile ? '' : 'w-auto'}`}>
                      <Dialog open={modalOpen && modalProject?.id === project.id} onOpenChange={setModalOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size={isMobile ? "sm" : "sm"} className={`${isMobile ? 'w-full' : ''} border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 h-9 sm:h-8`} onClick={() => handleViewDetails(project)}>
                            {t('project.viewDetails')}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{t('project.details', { name: project.name })}</DialogTitle>
                            <DialogDescription>{t('project.allEntries')}</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 mt-4">
                            {modalEntries.length === 0 ? (
                              <div className="text-gray-500 dark:text-gray-400">{t('project.noEntries')}</div>
                            ) : (
                              modalEntries.map((entry, idx) => (
                                <div key={entry.id || idx} className="border-l-4 border-blue-400 dark:border-blue-600 pl-4 py-2">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <div className="font-medium text-gray-900 dark:text-gray-100">
                                        {entry.users?.name || entry.users?.email || "Unknown User"}
                                      </div>
                                      <div className="text-sm text-gray-600 dark:text-gray-400">
                                        {entry.date} {entry.startTime && entry.endTime && `(${entry.startTime} - ${entry.endTime})`}
                                      </div>
                                      {entry.description && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                          Work Type: {entry.description}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <div className="font-medium text-blue-600 dark:text-blue-400">{entry.hours}h</div>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                          <DialogClose asChild>
                            <Button variant="outline" className="mt-4">Close</Button>
                          </DialogClose>
                        </DialogContent>
                      </Dialog>
                      {currentUser?.isAdmin && (
                        <>
                          <Button 
                            variant="outline" 
                            size={isMobile ? "sm" : "sm"} 
                            className={`${isMobile ? 'w-full' : ''} ${project.status === "closed" 
                              ? "border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/40" 
                              : "border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/40"
                            } h-9 sm:h-8`} 
                            onClick={() => handleCloseProject(project)}
                            title={project.status === "closed" ? "Reopen project" : "Close project"}
                          >
                            {project.status === "closed" ? (
                              <>
                                <LockOpen className="h-4 w-4 mr-1" />
                                {t('project.reopen')}
                              </>
                            ) : (
                              <>
                                <Lock className="h-4 w-4 mr-1" />
                                {t('project.close')}
                              </>
                            )}
                          </Button>
                          <Button 
                            variant="outline" 
                            size={isMobile ? "sm" : "sm"} 
                            className={`${isMobile ? 'w-full' : ''} border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/40 h-9 sm:h-8`} 
                            onClick={() => openDeleteConfirm(project)}
                          >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {t('project.delete')}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('project.deleteConfirm')}</DialogTitle>
                  <DialogDescription>
                    {t('project.deleteConfirmText', { name: projectToDelete?.name || '' })}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
                    {t('project.cancel')}
                  </Button>
                  <Button variant="destructive" onClick={handleDeleteProject}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('common.delete')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-xs sm:text-sm text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
              <strong className="text-blue-900 dark:text-blue-100">Note:</strong> Connect to Supabase to persist project data and enable team collaboration features.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProjectManagement;
