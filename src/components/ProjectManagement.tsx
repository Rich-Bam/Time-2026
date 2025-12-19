import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Users, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose
} from "@/components/ui/dialog";

const ProjectManagement = () => {
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    client: "",
    status: "active"
  });

  const { toast } = useToast();

  // Projects state from Supabase
  const [projects, setProjects] = useState<any[]>([]);
  // Map of projectId -> total hours
  const [projectHours, setProjectHours] = useState<Record<number, number>>({});
  // Time entries for modal
  const [modalEntries, setModalEntries] = useState<any[]>([]);
  const [modalProject, setModalProject] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Fetch projects from Supabase on mount (only global projects, not user-specific custom projects)
  useEffect(() => {
    const fetchProjects = async () => {
      // Only fetch global projects (user_id is null) - custom projects are user-specific
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .is("user_id", null);
      if (error) {
        toast({
          title: "Error loading projects",
          description: error.message,
          variant: "destructive",
        });
      } else if (data) {
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
      case "completed":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "on-hold":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Add New Project */}
      <Card className="lg:col-span-1 shadow-lg border-blue-100">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-t-lg">
          <CardTitle className="flex items-center text-blue-900">
            <Plus className="h-6 w-6 mr-3" />
            Add New Project
          </CardTitle>
          <CardDescription className="text-blue-700">
            Create a new project for time tracking
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="projectName" className="text-gray-700 font-medium">Project Name</Label>
              <Input
                id="projectName"
                placeholder="Enter project name"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                required
                className="border-blue-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client" className="text-gray-700 font-medium">Client</Label>
              <Input
                id="client"
                placeholder="Client name"
                value={newProject.client}
                onChange={(e) => setNewProject({ ...newProject, client: e.target.value })}
                required
                className="border-blue-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-gray-700 font-medium">Description</Label>
              <Textarea
                id="description"
                placeholder="Project description..."
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                className="border-blue-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg">
              <Plus className="h-5 w-5 mr-2" />
              Create Project
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Projects List */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="shadow-lg border-blue-100">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-t-lg">
            <CardTitle className="flex items-center text-blue-900">
              <FileText className="h-6 w-6 mr-3" />
              Active Projects
            </CardTitle>
            <CardDescription className="text-blue-700">
              Manage and track your projects
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              {projects.map((project) => (
                <div key={project.id} className="border border-blue-100 rounded-xl p-6 hover:shadow-md transition-all bg-gradient-to-r from-white to-blue-50">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{project.name}</h3>
                      <p className="text-blue-700 font-medium">{project.client}</p>
                    </div>
                    <Badge className={`${getStatusColor(project.status)} border font-medium`}>
                      {project.status}
                    </Badge>
                  </div>
                  <p className="text-gray-700 mb-4 leading-relaxed">{project.description}</p>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center space-x-6">
                      <div className="flex items-center">
                        <Clock className="h-5 w-5 mr-2 text-blue-600" />
                        <span className="font-medium">{projectHours[project.id] || 0}h logged</span>
                      </div>
                      <div className="flex items-center">
                        <Users className="h-5 w-5 mr-2 text-blue-600" />
                        <span className="font-medium">members</span>
                      </div>
                    </div>
                    <Dialog open={modalOpen && modalProject?.id === project.id} onOpenChange={setModalOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => handleViewDetails(project)}>
                          View Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Project Details: {project.name}</DialogTitle>
                          <DialogDescription>All time entries for this project</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                          {modalEntries.length === 0 ? (
                            <div className="text-gray-500">No time entries yet.</div>
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
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 p-6 bg-blue-50 rounded-xl text-blue-800 border border-blue-200">
              <strong className="text-blue-900">Note:</strong> Connect to Supabase to persist project data and enable team collaboration features.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProjectManagement;
