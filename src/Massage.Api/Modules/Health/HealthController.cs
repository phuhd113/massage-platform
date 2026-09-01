using Massage.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Modules.Health;

/// <summary>Kiểm tra tình trạng hệ thống.</summary>
[ApiController]
[Route("health")]
[Tags("Health")]
public class HealthController(AppDbContext db) : ControllerBase
{
    /// <summary>Trạng thái API, kết nối DB và phiên bản PostGIS.</summary>
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        // Kiểm tra cả PostGIS chứ không chỉ kết nối: thiếu extension thì mọi truy vấn
        // geo sẽ hỏng lúc chạy chứ không phải lúc khởi động, và health vẫn báo xanh.
        var postgis = await db.Database
            .SqlQuery<string>($"SELECT postgis_version() AS \"Value\"")
            .FirstAsync(ct);

        return Ok(new { status = "ok", database = "up", postgis });
    }
}
