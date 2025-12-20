import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface BugReportsProps {
  currentUser: any;
}

const BugReports = ({ currentUser }: BugReportsProps) => {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Bug Reports</CardTitle>
          <CardDescription>View and manage bug reports</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Bug reports functionality will be implemented here.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BugReports;
