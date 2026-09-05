using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Massage.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ZaloTokenStore : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "zalo_tokens",
                columns: table => new
                {
                    app_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    access_token = table.Column<string>(type: "text", nullable: false),
                    refresh_token = table.Column<string>(type: "text", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_zalo_tokens", x => x.app_id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "zalo_tokens");
        }
    }
}
