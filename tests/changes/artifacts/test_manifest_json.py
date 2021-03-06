from cStringIO import StringIO

from changes.artifacts.manifest_json import ManifestJsonHandler
from changes.constants import Result
from changes.models.failurereason import FailureReason
from changes.testutils import TestCase


class ManifestJsonHandlerTest(TestCase):
    json_file_format = '{"job_step_id": "%s"}'

    def test_correct_format(self):
        project = self.create_project()
        build = self.create_build(project)
        job = self.create_job(build)
        jobphase = self.create_jobphase(job)
        jobstep = self.create_jobstep(jobphase)
        artifact = self.create_artifact(jobstep, 'manifest.json')
        handler = ManifestJsonHandler(jobstep)

        fp = StringIO(self.json_file_format % jobstep.id.hex)
        handler.process(fp, artifact)
        assert not FailureReason.query.filter(FailureReason.step_id == jobstep.id).first()

    def test_wrong_jobstep_id(self):
        project = self.create_project()
        build = self.create_build(project)
        job = self.create_job(build)
        jobphase = self.create_jobphase(job)
        jobstep = self.create_jobstep(jobphase)
        artifact = self.create_artifact(jobstep, 'manifest.json')
        handler = ManifestJsonHandler(jobstep)

        fp = StringIO(self.json_file_format % '1')
        handler.process(fp, artifact)
        assert jobstep.result == Result.infra_failed
        assert FailureReason.query.filter(
            FailureReason.step_id == jobstep.id,
            FailureReason.reason == 'malformed_manifest_json',
        ).first()

    def test_malformed(self):
        project = self.create_project()
        build = self.create_build(project)
        job = self.create_job(build)
        jobphase = self.create_jobphase(job)
        jobstep = self.create_jobstep(jobphase)
        artifact = self.create_artifact(jobstep, 'manifest.json')
        handler = ManifestJsonHandler(jobstep)

        fp = StringIO('invalid_file')
        handler.process(fp, artifact)
        assert Result.infra_failed
        assert FailureReason.query.filter(
            FailureReason.step_id == jobstep.id,
            FailureReason.reason == 'malformed_manifest_json',
        ).first()
