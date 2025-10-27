// Individual app-specific permissions
// Add your custom permissions here when you create a new app from this template

export const individualPermissions: {
    name: string;
    description?: string;
}[] = [
    // Example:
    // { name: "articles_create", description: "Artikel erstellen" },
    // { name: "articles_edit", description: "Artikel bearbeiten" },
    // { name: "articles_delete", description: "Artikel l�schen" },
    // { name: "articles_view", description: "Artikel anzeigen" },
];

// Individual app-specific permission enum values
// Add your custom permissions here matching the names above
export enum IndividualAppPermissions {
    // Example:
    // ArticlesCreate = "articles_create",
    // ArticlesEdit = "articles_edit",
    // ArticlesDelete = "articles_delete",
    // ArticlesView = "articles_view",
}
