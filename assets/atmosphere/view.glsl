// Browser view shader for the original precomputed scattering model.
uniform vec3 camera;
uniform vec3 sun_direction;
uniform vec3 ground_albedo;
uniform float exposure;
in vec3 view_ray;
out vec4 color;
void main() {
  vec3 ray = normalize(view_ray);
  vec3 transmittance;
  vec3 radiance = GetSkyRadiance(camera, ray, 0.0, sun_direction, transmittance);
  float b = dot(camera, ray);
  float discriminant = b * b - dot(camera, camera) + 6360.0 * 6360.0;
  float distance_to_ground = discriminant >= 0.0 ? -b - sqrt(discriminant) : -1.0;
  if (distance_to_ground > 0.0) {
    vec3 point = camera + ray * distance_to_ground;
    // Avoid roundoff placing the surface outside the valid LUT radius.
    point = normalize(point) * 6360.0;
    vec3 sky_irradiance;
    vec3 direct = GetSunAndSkyIrradiance(point, normalize(point), sun_direction, sky_irradiance);
    vec3 inscatter = GetSkyRadianceToPoint(camera, point, 0.0, sun_direction, transmittance);
    radiance = ground_albedo / PI * (direct + sky_irradiance) * transmittance + inscatter;
  } else {
    float angular_pixel = max(length(fwidth(ray)), 0.00001);
    float angle = acos(clamp(dot(ray, sun_direction), -1.0, 1.0));
    float disk = 1.0 - smoothstep(0.004675 - angular_pixel, 0.004675 + angular_pixel, angle);
    radiance += transmittance * GetSolarRadiance() * disk;
  }
  color = vec4(pow(1.0 - exp(-max(radiance, vec3(0.0)) * exposure), vec3(1.0 / 2.2)), 1.0);
}
