import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Plus, FileText, Users, Clock, Trash2, Lock, LockOpen } from "lucide-react";
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
      const { data, error } = await supabase.from("timesheet").select("project_id, hours");
      if (data) {
        const hoursMap: Record<number, number> = {};
        data.forEach((entry: { project_id: number; hours: number }) => {
          if (!hoursMap[entry.project_id]) hoursMap[entry.project_id] = 0;
          hoursMap[entry.project_id] += Number(entry.hours) || 0;
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
    const { data, error } = await supabase
      .from("timesheet")
      .select("*, projects(name), user_id")
      .eq("project_id", project.id);
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

  return (
    <div className={`grid grid-cols-1 ${isMobile ? '' : 'lg:grid-cols-3'} gap-4 sm:gap-6 lg:gap-8`}>
      {/* Add New Project */}
      <Card className={`${isMobile ? '' : 'lg:col-span-1'} shadow-lg border-blue-100`}>
        <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-t-lg p-4 sm:p-6">
          <CardTitle className="flex items-center text-blue-900 text-lg sm:text-xl">
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
              <Label htmlFor="projectName" className="text-sm text-gray-700 font-medium">{t('project.name')}</Label>
              <Input
                id="projectName"
                placeholder={t('project.namePlaceholder')}
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                required
                className="h-10 sm:h-9 border-blue-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client" className="text-sm text-gray-700 font-medium">{t('project.client')}</Label>
              <Input
                id="client"
                placeholder={t('project.clientPlaceholder')}
                value={newProject.client}
                onChange={(e) => setNewProject({ ...newProject, client: e.target.value })}
                required
                className="h-10 sm:h-9 border-blue-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm text-gray-700 font-medium">{t('project.description')}</Label>
              <Textarea
                id="description"
                placeholder={t('project.descriptionPlaceholder')}
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                className="min-h-[80px] border-blue-200 focus:border-blue-500 focus:ring-blue-500"
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
        <Card className="shadow-lg border-blue-100">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-t-lg p-4 sm:p-6">
            <CardTitle className="flex items-center text-blue-900 text-lg sm:text-xl">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3" />
              {t('project.active')}
            </CardTitle>
            <CardDescription className="text-blue-700 text-sm">
              {t('project.manage')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-4 sm:space-y-6">
              {projects.map((project) => (
                <div key={project.id} className="border border-blue-100 rounded-xl p-4 sm:p-6 hover:shadow-md transition-all bg-gradient-to-r from-white to-blue-50">
                  <div className={`flex ${isMobile ? 'flex-col' : 'justify-between items-start'} gap-3 mb-4`}>
                    <div className="flex-1">
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900">{project.name}</h3>
                      <p className="text-sm sm:text-base text-blue-700 font-medium">{project.client}</p>
                    </div>
                    <Badge className={`${getStatusColor(project.status || "active")} border font-medium text-xs`}>
                      {project.status === "closed" ? "Closed" : project.status || "Active"}
                    </Badge>
                  </div>
                  <p className="text-sm sm:text-base text-gray-700 mb-4 leading-relaxed">{project.description}</p>
                  <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'} gap-3 sm:gap-0 text-xs sm:text-sm text-gray-600`}>
                    <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} ${isMobile ? 'gap-2' : 'space-x-6'}`}>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-blue-600" />
                        <span className="font-medium">{t('project.hoursLogged', { hours: String(projectHours[project.id] || 0) })}</span>
                      </div>
                      <div className="flex items-center">
                        <Users className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-blue-600" />
                        <span className="font-medium">{t('project.members')}</span>
                      </div>
                    </div>
                    <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} ${isMobile ? 'gap-2' : 'gap-2'} w-full ${isMobile ? '' : 'w-auto'}`}>
                      <Dialog open={modalOpen && modalProject?.id === project.id} onOpenChange={setModalOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size={isMobile ? "sm" : "sm"} className={`${isMobile ? 'w-full' : ''} border-blue-200 text-blue-700 hover:bg-blue-50 h-9 sm:h-8`} onClick={() => handleViewDetails(project)}>
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
                              <div className="text-gray-500">{t('project.noEntries')}</div>
                            ) : (
                              modalEntries.map((entry, idx) => (
                                <div key={idx} className="border-l-4 border-blue-400 pl-4 py-2">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <div className="font-medium text-gray-900">{entry.user_id || "Unknown User"}</div>
                                      <div className="text-sm text-gray-600">{entry.description}</div>
                                    </div>
                                    <div className="text-right">
                                      <div className="font-medium text-blue-600">{entry.hours}h</div>
                                      <div className="text-xs text-gray-500">{entry.date}</div>
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
                              ? "border-green-200 text-green-700 hover:bg-green-50" 
                              : "border-orange-200 text-orange-700 hover:bg-orange-50"
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
                            className={`${isMobile ? 'w-full' : ''} border-red-200 text-red-700 hover:bg-red-50 h-9 sm:h-8`} 
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
            <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-blue-50 rounded-xl text-xs sm:text-sm text-blue-800 border border-blue-200">
              <strong className="text-blue-900">Note:</strong> Connect to Supabase to persist project data and enable team collaboration features.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProjectManagement;
