using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Massage.Api.Data.Migrations
{
    /// <summary>
    /// Mốc đã báo ban quản trị rằng hồ sơ chờ duyệt — chống gửi trùng email.
    ///
    /// Nullable và **không backfill**: hồ sơ có trước migration này chưa từng sinh email
    /// nào, và gán một mốc giả cho chúng nghĩa là lượt cam kết/gửi CCCD tiếp theo của
    /// chúng sẽ bị coi là "đã báo rồi" và im lặng trôi qua. Để NULL thì hồ sơ cũ nào còn
    /// đang chờ sẽ sinh thông báo ở lần chạm tiếp theo — đúng điều mong muốn.
    /// </summary>
    public partial class KtvSubmissionNotified : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder) =>
            migrationBuilder.Sql("""
                ALTER TABLE ktv_profiles
                  ADD COLUMN submission_notified_at TIMESTAMPTZ NULL;
                """);

        protected override void Down(MigrationBuilder migrationBuilder) =>
            migrationBuilder.Sql("""
                ALTER TABLE ktv_profiles
                  DROP COLUMN IF EXISTS submission_notified_at;
                """);
    }
}
